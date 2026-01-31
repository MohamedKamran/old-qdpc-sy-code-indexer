import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface IndexState {
  totalFiles: number;
  totalBlocks: number;
  lastIndexed: number;
  isIndexing: boolean;
  currentFile?: string;
  progress: number;
  errors: number;
}

interface WorkspaceMetadata {
  workspacePath: string;
  languages: Record<string, number>;
  largestFiles: Array<{ path: string; size: number }>;
  indexSize: number;
  indexVersion: string;
}

export class StateManager {
  private statePath: string;
  private metadataPath: string;
  private state: IndexState;
  private metadata: WorkspaceMetadata;

  constructor(indexPath: string) {
    this.statePath = path.join(indexPath, 'state.json');
    this.metadataPath = path.join(indexPath, 'metadata.json');
    
    this.state = {
      totalFiles: 0,
      totalBlocks: 0,
      lastIndexed: 0,
      isIndexing: false,
      progress: 0,
      errors: 0
    };

    this.metadata = {
      workspacePath: '',
      languages: {},
      largestFiles: [],
      indexSize: 0,
      indexVersion: '1.0.0'
    };
  }

  async load(): Promise<void> {
    if (existsSync(this.statePath)) {
      const content = await fs.readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(content);
    }

    if (existsSync(this.metadataPath)) {
      const content = await fs.readFile(this.metadataPath, 'utf-8');
      this.metadata = JSON.parse(content);
    }
  }

  async save(): Promise<void> {
    await Promise.all([
      fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2)),
      fs.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2))
    ]);
  }

  getState(): Readonly<IndexState> {
    return this.state;
  }

  getMetadata(): Readonly<WorkspaceMetadata> {
    return this.metadata;
  }

  startIndexing(): void {
    this.state.isIndexing = true;
    this.state.progress = 0;
    this.state.errors = 0;
  }

  stopIndexing(): void {
    this.state.isIndexing = false;
    this.state.lastIndexed = Date.now();
  }

  updateProgress(current: number, total: number): void {
    this.state.progress = Math.round((current / total) * 100);
  }

  setCurrentFile(filePath: string): void {
    this.state.currentFile = filePath;
  }

  incrementFiles(): void {
    this.state.totalFiles++;
  }

  incrementBlocks(): void {
    this.state.totalBlocks++;
  }

  incrementErrors(): void {
    this.state.errors++;
  }

  updateLanguageStats(language: string): void {
    this.metadata.languages[language] = (this.metadata.languages[language] || 0) + 1;
  }

  updateIndexSize(size: number): void {
    this.metadata.indexSize = size;
  }

  setWorkspacePath(workspacePath: string): void {
    this.metadata.workspacePath = workspacePath;
  }

  isIndexing(): boolean {
    return this.state.isIndexing;
  }
}
