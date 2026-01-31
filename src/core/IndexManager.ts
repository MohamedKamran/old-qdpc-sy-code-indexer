import path from 'path';
import { ConfigManager } from './ConfigManager';
import { StateManager } from './StateManager';
import { CacheManager } from './CacheManager';
import { VectorStore } from '../storage/VectorStore';
import { OllamaEmbedder } from '../embedders/OllamaEmbedder';
import type { IEmbedder } from '../embedders/EmbedderInterface';
import { FileWatcher } from '../scanner/FileWatcher';
import { CodeParser } from '../parsers/CodeParser';
import { ChunkingStrategy } from '../parsers/ChunkingStrategy';
import { DirectoryScanner } from '../scanner/DirectoryScanner';
import { BatchProcessor } from '../scanner/BatchProcessor';

import * as fs from 'fs/promises';

export interface IndexOptions {
  force?: boolean;
  verbose?: boolean;
}

export class IndexManager {
  private workspacePath: string;
  private configManager: ConfigManager;
  private stateManager: StateManager;
  private cacheManager: CacheManager;
  private vectorStore: VectorStore;
  private embedder: IEmbedder;
  private parser: CodeParser;
  private scanner: DirectoryScanner;
  private batchProcessor: BatchProcessor;
  private fileWatcher: FileWatcher | null = null;

  constructor(
    workspacePath: string,
    configManager: ConfigManager,
    stateManager: StateManager,
    cacheManager: CacheManager
  ) {
    this.workspacePath = workspacePath;
    this.configManager = configManager;
    this.stateManager = stateManager;
    this.cacheManager = cacheManager;

    const indexPath = configManager.getIndexPath();
    const embedderConfig = configManager.get('embedder');
    const indexingConfig = configManager.get('indexing');

    this.vectorStore = new VectorStore(indexPath, {
      space: 'cosine',
      numDimensions: embedderConfig.dimensions,
      maxElements: 1000000,
      M: 16,
      efConstruction: 200
    });

    this.embedder = new OllamaEmbedder({
      model: embedderConfig.model,
      dimensions: embedderConfig.dimensions,
      baseUrl: embedderConfig.baseUrl || 'http://localhost:11434'
    });
    
    const chunkingStrategy = new ChunkingStrategy({
      targetTokens: indexingConfig.chunkTokens,
      maxTokens: 2048,
      overlapTokens: indexingConfig.overlapTokens,
      preserveFunctionBoundaries: true,
      preserveClassBoundaries: true,
      includeParentContext: true
    });

    this.parser = new CodeParser(chunkingStrategy);
    this.scanner = new DirectoryScanner({
      excludePatterns: indexingConfig.excludePatterns
    });

    this.batchProcessor = new BatchProcessor(
      this.parser,
      this.embedder,
      this.vectorStore,
      this.cacheManager,
      {
        batchSize: indexingConfig.batchSize,
        concurrency: indexingConfig.concurrency
      }
    );
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.embedder.initialize();
    this.stateManager.setWorkspacePath(this.workspacePath);
  }

  async indexWorkspace(options: IndexOptions = {}): Promise<void> {
    this.stateManager.startIndexing();

    try {
      const scanResult = await this.scanner.scan(this.workspacePath);
      
      if (scanResult.files.length === 0) {
        console.log('No files to index');
        return;
      }

      console.log(`Found ${scanResult.files.length} files to index`);

      const filesToIndex = options.force 
        ? scanResult.files 
        : await this.filterChangedFiles(scanResult.files);

      if (filesToIndex.length === 0) {
        console.log('No changes to index');
        return;
      }

      console.log(`Indexing ${filesToIndex.length} files...`);

      await this.batchProcessor.processFiles(
        filesToIndex.map(f => path.join(this.workspacePath, f))
      );

      this.stateManager.stopIndexing();
      await this.vectorStore.save();
    } catch (error) {
      this.stateManager.incrementErrors();
      throw error;
    }
  }

  async filterChangedFiles(files: string[]): Promise<string[]> {
    const changed: string[] = [];

    for (const file of files) {
      const fullPath = path.join(this.workspacePath, file);
      
      try {
        const stats = await fs.stat(fullPath);
        const cached = this.cacheManager.getEntry(file);
        
        if (!cached || cached.lastModified !== stats.mtimeMs) {
          changed.push(fullPath);
        }
      } catch {
        changed.push(fullPath);
      }
    }

    return changed;
  }

  async watch(): Promise<void> {
    const watchConfig = this.configManager.get('watch');
    
    if (!watchConfig.enabled) {
      console.log('File watching is disabled in config');
      return;
    }

    this.fileWatcher = new FileWatcher(
      this.workspacePath,
      this.batchProcessor
    );

    await this.fileWatcher.start({
      ignored: watchConfig.ignored,
      debounceMs: watchConfig.debounceMs
    });

    process.on('SIGINT', () => this.dispose());
  }

  async dispose(): Promise<void> {
    if (this.fileWatcher) {
      await this.fileWatcher.stop();
    }
    
    this.embedder.dispose();
    this.vectorStore.close();
    await this.stateManager.save();
    await this.cacheManager.save();
  }
}
