import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import hnswlib from 'hnswlib-node';
import { createTablesSQL, insertInitialMetadataSQL, CodeBlock, FileMetadata, SearchStats } from './Schema.js';

const { HierarchicalNSW } = hnswlib;
type HierarchicalNSWType = InstanceType<typeof HierarchicalNSW>;

interface VectorIndexConfig {
  space: 'cosine' | 'l2' | 'ip';
  numDimensions: number;
  maxElements: number;
  M: number;
  efConstruction: number;
}

export class VectorStore {
  private db: Database.Database;
  private hnswIndex: HierarchicalNSWType | null = null;
  private hnswConfig: VectorIndexConfig;
  private indexPath: string;
  private nextLabel: number = 0;

  constructor(indexPath: string, config: VectorIndexConfig) {
    this.indexPath = indexPath;
    this.hnswConfig = config;
    const dbPath = path.join(indexPath, 'cache.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
  }

  async initialize(): Promise<void> {
    this.db.exec(createTablesSQL);
    
    const insertMetadata = this.db.prepare(insertInitialMetadataSQL);
    insertMetadata.run(Date.now());
    
    // Load next label from existing vector_map
    const maxLabel = this.db.prepare('SELECT MAX(label) as max_label FROM vector_map').get() as any;
    this.nextLabel = (maxLabel?.max_label ?? -1) + 1;
    
    await this.initializeHNSW();
  }

  async initializeHNSW(): Promise<void> {
    const hnswPath = path.join(this.indexPath, 'vectors.hnsw');
    
    try {
      const exists = await fs.access(hnswPath).then(() => true).catch(() => false);
      
      this.hnswIndex = new HierarchicalNSW(this.hnswConfig.space, this.hnswConfig.numDimensions);
      
      if (exists) {
        await this.hnswIndex.readIndex(hnswPath);
        
        // Ensure the loaded index has the correct capacity
        const currentMax = this.hnswIndex.getMaxElements();
        if (currentMax < this.hnswConfig.maxElements) {
          console.log(`Resizing loaded index from ${currentMax} to ${this.hnswConfig.maxElements} elements`);
          this.hnswIndex.resizeIndex(this.hnswConfig.maxElements);
        }
      } else {
        this.hnswIndex.initIndex(
          this.hnswConfig.maxElements,
          this.hnswConfig.M,
          this.hnswConfig.efConstruction
        );
      }
    } catch (error) {
      throw new Error(`Failed to initialize HNSW index: ${error}`);
    }
  }

  addCodeBlock(block: CodeBlock): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_blocks 
      (id, file_path, start_line, end_line, content, content_hash, block_type, language, 
       symbol_name, parent_symbol, tokens, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      block.id,
      block.filePath,
      block.startLine,
      block.endLine,
      block.content,
      block.contentHash,
      block.blockType,
      block.language,
      block.symbolName || null,
      block.parentSymbol || null,
      block.tokens,
      block.createdAt,
      block.updatedAt
    );

    const ftsStmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_fts (block_id, file_path, content, symbol_name)
      VALUES (?, ?, ?, ?)
    `);
    
    ftsStmt.run(block.id, block.filePath, block.content, block.symbolName || '');
  }

  addFileMetadata(metadata: FileMetadata): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files 
      (file_path, file_hash, language, size_bytes, line_count, last_indexed, block_count, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      metadata.filePath,
      metadata.fileHash,
      metadata.language,
      metadata.sizeBytes,
      metadata.lineCount,
      metadata.lastIndexed,
      metadata.blockCount,
      metadata.isDeleted ? 1 : 0
    );
  }

  addVector(id: string, vector: Float32Array): void {
    if (!this.hnswIndex) {
      throw new Error('HNSW index not initialized');
    }

    // Check if we need to resize the index
    const currentCount = this.hnswIndex.getCurrentCount();
    const maxElements = this.hnswIndex.getMaxElements();
    
    if (currentCount >= maxElements - 1) {
      const newSize = maxElements * 2;
      this.hnswIndex.resizeIndex(newSize);
    }

    const label = this.nextLabel++;
    
    // Store mapping from integer label to block ID
    const mapStmt = this.db.prepare('INSERT OR REPLACE INTO vector_map (label, block_id) VALUES (?, ?)');
    mapStmt.run(label, id);
    
    this.hnswIndex.addPoint(Array.from(vector), label);
  }

  labelToBlockId(label: number): string | undefined {
    const row = this.db.prepare('SELECT block_id FROM vector_map WHERE label = ?').get(label) as any;
    return row?.block_id;
  }

  searchKNN(queryVector: Float32Array, k: number, efSearch?: number): Array<{ label: number; distance: number }> {
    if (!this.hnswIndex) {
      throw new Error('HNSW index not initialized');
    }

    if (efSearch) {
      this.hnswIndex.setEf(efSearch);
    }

    const result = this.hnswIndex.searchKnn(Array.from(queryVector), k);
    return result.neighbors.map((neighbor: number, i: number) => ({
      label: neighbor,
      distance: result.distances[i]
    }));
  }

  getCodeBlock(id: string): CodeBlock | undefined {
    const stmt = this.db.prepare('SELECT * FROM code_blocks WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;

    return {
      id: row.id,
      filePath: row.file_path,
      startLine: row.start_line,
      endLine: row.end_line,
      content: row.content,
      contentHash: row.content_hash,
      blockType: row.block_type,
      language: row.language,
      symbolName: row.symbol_name,
      parentSymbol: row.parent_symbol,
      tokens: row.tokens,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  getBlocksByFile(filePath: string): CodeBlock[] {
    const stmt = this.db.prepare('SELECT * FROM code_blocks WHERE file_path = ?');
    const rows = stmt.all(filePath) as any[];
    
    return rows.map(row => ({
      id: row.id,
      filePath: row.file_path,
      startLine: row.start_line,
      endLine: row.end_line,
      content: row.content,
      contentHash: row.content_hash,
      blockType: row.block_type,
      language: row.language,
      symbolName: row.symbol_name,
      parentSymbol: row.parent_symbol,
      tokens: row.tokens,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  deleteBlocksByFile(filePath: string): void {
    // Get block IDs first
    const getBlocksStmt = this.db.prepare('SELECT id FROM code_blocks WHERE file_path = ?');
    const blocks = getBlocksStmt.all(filePath) as Array<{ id: string }>;

    // Delete FTS entries
    const deleteFtsStmt = this.db.prepare('DELETE FROM code_fts WHERE block_id IN (SELECT id FROM code_blocks WHERE file_path = ?)');
    deleteFtsStmt.run(filePath);

    // Mark vectors as deleted in HNSW and remove mappings
    for (const block of blocks) {
      const mapRow = this.db.prepare('SELECT label FROM vector_map WHERE block_id = ?').get(block.id) as any;
      if (mapRow && this.hnswIndex) {
        try { this.hnswIndex.markDelete(mapRow.label); } catch { /* already deleted */ }
      }
      this.db.prepare('DELETE FROM vector_map WHERE block_id = ?').run(block.id);
    }

    // Delete code blocks
    const deleteStmt = this.db.prepare('DELETE FROM code_blocks WHERE file_path = ?');
    deleteStmt.run(filePath);
  }

  fullTextSearch(query: string, limit?: number): Array<{ blockId: string; score: number }> {
    // Sanitize query for FTS5 - escape special characters and wrap in quotes
    const sanitized = query
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .trim()
      .split(/\s+/) // Split into words
      .filter(word => word.length > 0)
      .join(' OR '); // Join with OR operator
    
    if (!sanitized) {
      return [];
    }
    
    const stmt = this.db.prepare(`
      SELECT block_id, bm25(code_fts) as score 
      FROM code_fts 
      WHERE code_fts MATCH ? 
      ORDER BY score
      ${limit ? 'LIMIT ?' : ''}
    `);
    
    const results = (limit ? stmt.all(sanitized, limit) : stmt.all(sanitized)) as Array<{ block_id: string; score: number }>;
    
    return results.map(r => ({
      blockId: r.block_id,
      score: r.score
    }));
  }

  getFileMetadata(filePath: string): FileMetadata | undefined {
    const stmt = this.db.prepare('SELECT * FROM files WHERE file_path = ?');
    const row = stmt.get(filePath) as any;
    
    if (!row) return undefined;

    return {
      filePath: row.file_path,
      fileHash: row.file_hash,
      language: row.language,
      sizeBytes: row.size_bytes,
      lineCount: row.line_count,
      lastIndexed: row.last_indexed,
      blockCount: row.block_count,
      isDeleted: row.is_deleted === 1
    };
  }

  getAllFiles(): FileMetadata[] {
    const stmt = this.db.prepare('SELECT * FROM files WHERE is_deleted = 0');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      filePath: row.file_path,
      fileHash: row.file_hash,
      language: row.language,
      sizeBytes: row.size_bytes,
      lineCount: row.line_count,
      lastIndexed: row.last_indexed,
      blockCount: row.block_count,
      isDeleted: row.is_deleted === 1
    }));
  }

  recordSearchStats(stats: SearchStats): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO search_stats 
      (query_hash, query, result_count, avg_score, execution_time_ms, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      stats.queryHash,
      stats.query,
      stats.resultCount,
      stats.avgScore,
      stats.executionTimeMs,
      stats.timestamp
    );
  }

  getStats(): {
    totalBlocks: number;
    totalFiles: number;
    languages: Record<string, number>;
    totalSearches: number;
  } {
    const blocksStmt = this.db.prepare('SELECT COUNT(*) as count FROM code_blocks');
    const filesStmt = this.db.prepare('SELECT COUNT(*) as count FROM files WHERE is_deleted = 0');
    const langStmt = this.db.prepare('SELECT language, COUNT(*) as count FROM code_blocks GROUP BY language');
    const searchStmt = this.db.prepare('SELECT COUNT(*) as count FROM search_stats');

    const totalBlocks = (blocksStmt.get() as any).count;
    const totalFiles = (filesStmt.get() as any).count;
    const langRows = langStmt.all() as Array<{ language: string; count: number }>;
    const totalSearches = (searchStmt.get() as any).count;

    const languages: Record<string, number> = {};
    for (const row of langRows) {
      languages[row.language] = row.count;
    }

    return { totalBlocks, totalFiles, languages, totalSearches };
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  async save(): Promise<void> {
    const hnswPath = path.join(this.indexPath, 'vectors.hnsw');
    if (this.hnswIndex) {
      await this.hnswIndex.writeIndex(hnswPath);
    }
  }

  close(): void {
    this.db.close();
  }
}
