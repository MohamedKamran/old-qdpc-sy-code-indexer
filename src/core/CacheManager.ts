import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

interface FileHashEntry {
  hash: string;
  lastModified: number;
  size: number;
}

export class CacheManager {
  private cachePath: string;
  private cache: Map<string, FileHashEntry>;
  private dirty: boolean;

  constructor(indexPath: string) {
    this.cachePath = path.join(indexPath, 'file-hashes.json');
    this.cache = new Map();
    this.dirty = false;
  }

  async load(): Promise<void> {
    if (existsSync(this.cachePath)) {
      const content = await fs.readFile(this.cachePath, 'utf-8');
      const data = JSON.parse(content) as Record<string, FileHashEntry>;
      this.cache = new Map(Object.entries(data));
    }
  }

  async save(): Promise<void> {
    if (this.dirty) {
      const data = Object.fromEntries(this.cache);
      await fs.writeFile(this.cachePath, JSON.stringify(data, null, 2));
      this.dirty = false;
    }
  }

  getHash(filePath: string): string | undefined {
    const entry = this.cache.get(filePath);
    return entry?.hash;
  }

  getEntry(filePath: string): FileHashEntry | undefined {
    return this.cache.get(filePath);
  }

  setHash(filePath: string, hash: string, size: number, lastModified: number): void {
    this.cache.set(filePath, { hash, size, lastModified });
    this.dirty = true;
  }

  deleteHash(filePath: string): void {
    this.cache.delete(filePath);
    this.dirty = true;
  }

  clear(): void {
    this.cache.clear();
    this.dirty = true;
  }

  has(filePath: string): boolean {
    return this.cache.has(filePath);
  }

  getSize(): number {
    return this.cache.size;
  }

  static calculateHash(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static async calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return this.calculateHash(content);
  }
}
