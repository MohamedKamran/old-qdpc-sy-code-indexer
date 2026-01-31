import pLimit from 'p-limit';
import { CodeParser } from '../parsers/CodeParser';
import { OllamaEmbedder } from '../embedders/OllamaEmbedder';
import type { IEmbedder } from '../embedders/EmbedderInterface';
import { VectorStore } from '../storage/VectorStore';
import { CacheManager } from '../core/CacheManager';

import * as fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

export interface BatchProcessorOptions {
  batchSize: number;
  concurrency: number;
}

export class BatchProcessor {
  private parser: CodeParser;
  private embedder: IEmbedder;
  private vectorStore: VectorStore;
  private cacheManager: CacheManager;
  private options: BatchProcessorOptions;

  constructor(
    parser: CodeParser,
    embedder: IEmbedder,
    vectorStore: VectorStore,
    cacheManager: CacheManager,
    options: BatchProcessorOptions
  ) {
    this.parser = parser;
    this.embedder = embedder;
    this.vectorStore = vectorStore;
    this.cacheManager = cacheManager;
    this.options = options;
  }

  async processFiles(filePaths: string[]): Promise<void> {
    const totalFiles = filePaths.length;
    let processedFiles = 0;

    const limiter = pLimit(this.options.concurrency);

    const processFile = async (filePath: string) => {
      try {
        const relativePath = path.relative(process.cwd(), filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const fileHash = this.calculateHash(content);
        const stats = await fs.stat(filePath);

        const cached = this.cacheManager.getEntry(relativePath);
        
        if (cached && cached.hash === fileHash) {
          processedFiles++;
          return;
        }

        this.vectorStore.transaction(() => {
          this.vectorStore.deleteBlocksByFile(relativePath);
        });

        const parsed = await this.parser.parseFile(filePath);

        const contents = parsed.blocks.map(b => b.content);
        const embeddings = await this.embedder.embedBatch(contents);

        this.vectorStore.transaction(() => {
          for (let i = 0; i < parsed.blocks.length; i++) {
            const block = parsed.blocks[i];
            this.vectorStore.addCodeBlock(block);
            this.vectorStore.addVector(block.id, embeddings[i]);
          }

          this.vectorStore.addFileMetadata({
            filePath: relativePath,
            fileHash,
            language: parsed.language,
            sizeBytes: parsed.sizeBytes,
            lineCount: parsed.lineCount,
            lastIndexed: Date.now(),
            blockCount: parsed.blocks.length,
            isDeleted: false
          });
        });

        this.cacheManager.setHash(
          relativePath,
          fileHash,
          stats.size,
          stats.mtimeMs
        );

        processedFiles++;
        
        if (processedFiles % 10 === 0) {
          console.log(`Progress: ${processedFiles}/${totalFiles} files`);
        }
      } catch (error) {
        console.error(`Failed to process ${filePath}:`, error);
      }
    };

    const batches = this.createBatches(filePaths, this.options.batchSize);

    for (const batch of batches) {
      await Promise.all(batch.map(file => limiter(() => processFile(file))));
    }

    console.log(`Completed: ${processedFiles}/${totalFiles} files`);
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
