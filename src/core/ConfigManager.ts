import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface EmbedderConfig {
  provider: 'ollama';
  model: string;
  dimensions: number;
  baseUrl: string;
}

interface IndexingConfig {
  batchSize: number;
  concurrency: number;
  chunkTokens: number;
  overlapTokens: number;
  maxFileSize: number;
  excludePatterns: string[];
}

interface SearchConfig {
  maxResults: number;
  minScore: number;
  hybridWeight: {
    semantic: number;
    keyword: number;
  };
  rerank: boolean;
}

interface WatchConfig {
  enabled: boolean;
  debounceMs: number;
  ignored: string[];
}

interface PerformanceConfig {
  hnswEfSearch: number;
  cacheSize: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface Config {
  version: string;
  embedder: EmbedderConfig;
  indexing: IndexingConfig;
  search: SearchConfig;
  watch: WatchConfig;
  performance: PerformanceConfig;
}

const DEFAULT_CONFIG: Config = {
  version: '1.0.0',
  embedder: {
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    baseUrl: 'http://localhost:11434'
  },
  indexing: {
    batchSize: 50,
    concurrency: 4,
    chunkTokens: 384,
    overlapTokens: 50,
    maxFileSize: 1048576,
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.syntheo/**'
    ]
  },
  search: {
    maxResults: 20,
    minScore: 0.3,
    hybridWeight: {
      semantic: 0.7,
      keyword: 0.3
    },
    rerank: true
  },
  watch: {
    enabled: true,
    debounceMs: 500,
    ignored: ['**/node_modules/**', '**/.git/**', '**/.syntheo/**']
  },
  performance: {
    hnswEfSearch: 100,
    cacheSize: 10000,
    logLevel: 'info'
  }
};

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(workspacePath: string) {
    this.configPath = path.join(workspacePath, '.syntheo', 'semantics', 'config.json');
    this.config = DEFAULT_CONFIG;
  }

  async load(): Promise<void> {
    if (existsSync(this.configPath)) {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(content) as Partial<Config>;
      this.config = { ...DEFAULT_CONFIG, ...loaded };
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
  }

  getAll(): Readonly<Config> {
    return this.config;
  }

  getIndexPath(): string {
    return path.dirname(this.configPath);
  }
}
