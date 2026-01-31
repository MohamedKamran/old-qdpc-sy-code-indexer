import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../src/core/ConfigManager';
import { StateManager } from '../src/core/StateManager';
import { CacheManager } from '../src/core/CacheManager';
import { ChunkingStrategy } from '../src/parsers/ChunkingStrategy';

describe('Core Components', () => {
  describe('ConfigManager', () => {
    it('should create default config', () => {
      const config = new ConfigManager('/tmp/test');
      expect(config.get('embedder')).toBeDefined();
      expect(config.get('embedder').provider).toBe('local');
    });
  });

  describe('StateManager', () => {
    it('should create default state', () => {
      const state = new StateManager('/tmp/test');
      const current = state.getState();
      expect(current.totalFiles).toBe(0);
      expect(current.totalBlocks).toBe(0);
      expect(current.isIndexing).toBe(false);
    });
  });

  describe('CacheManager', () => {
    it('should manage file hashes', () => {
      const cache = new CacheManager('/tmp/test');
      expect(cache.getSize()).toBe(0);
      
      cache.setHash('test.ts', 'abc123', 1024, Date.now());
      expect(cache.has('test.ts')).toBe(true);
      expect(cache.getHash('test.ts')).toBe('abc123');
    });
  });

  describe('ChunkingStrategy', () => {
    it('should create chunking strategy', () => {
      const strategy = new ChunkingStrategy();
      expect(strategy).toBeDefined();
    });

    it('should estimate tokens', () => {
      const strategy = new ChunkingStrategy();
      const text = 'function hello() { return "world"; }';
      const tokens = (strategy as any).estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });
  });
});
