import chokidar from 'chokidar';
import path from 'path';
import { CacheManager } from '../core/CacheManager';
import { BatchProcessor } from './BatchProcessor';
import { ConfigManager } from '../core/ConfigManager';

export interface FileWatcherOptions {
  ignored?: string[];
  debounceMs?: number;
}

export class FileWatcher {
  private workspacePath: string;
  private cacheManager: CacheManager;
  private batchProcessor: BatchProcessor;
  private watcher: chokidar.FSWatcher | null = null;
  private debounceMs: number;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    workspacePath: string,
    cacheManager: CacheManager,
    batchProcessor: BatchProcessor
  ) {
    this.workspacePath = workspacePath;
    this.cacheManager = cacheManager;
    this.batchProcessor = batchProcessor;
    this.debounceMs = 500;
  }

  async start(options: FileWatcherOptions = {}): Promise<void> {
    this.debounceMs = options.debounceMs || 500;

    this.watcher = chokidar.watch(this.workspacePath, {
      ignored: options.ignored || [],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    this.watcher
      .on('change', (filePath) => this.handleFileChange(filePath, 'modified'))
      .on('add', (filePath) => this.handleFileChange(filePath, 'created'))
      .on('unlink', (filePath) => this.handleFileDelete(filePath))
      .on('error', (error) => console.error(`Watcher error: ${error}`));

    console.log('File watcher started');
  }

  private handleFileChange(filePath: string, changeType: 'created' | 'modified'): void {
    const relativePath = path.relative(this.workspacePath, filePath);

    if (this.isCodeFile(filePath)) {
      this.debounce(relativePath, async () => {
        try {
          console.log(`Indexing ${changeType} file: ${relativePath}`);
          await this.batchProcessor.processFiles([filePath]);
        } catch (error) {
          console.error(`Failed to index ${relativePath}:`, error);
        }
      });
    }
  }

  private handleFileDelete(filePath: string): void {
    const relativePath = path.relative(this.workspacePath, filePath);

    this.debounce(relativePath, async () => {
      try {
        console.log(`Removing deleted file from index: ${relativePath}`);
        await this.batchProcessor.processFiles([filePath]);
      } catch (error) {
        console.error(`Failed to remove ${relativePath}:`, error);
      }
    });
  }

  private debounce(key: string, fn: () => Promise<void>): void {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      await fn();
      this.debounceTimers.delete(key);
    }, this.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.java', '.go', '.rs', '.rb', '.php',
      '.cs', '.kt', '.swift', '.html', '.css', '.scss',
      '.sql', '.md'
    ];

    const ext = path.extname(filePath).toLowerCase();
    return codeExtensions.includes(ext);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();
    }
  }
}
