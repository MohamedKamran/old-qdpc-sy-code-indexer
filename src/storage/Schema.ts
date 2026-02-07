export const SCHEMA_VERSION = '1.0.0';

export const createTablesSQL = `
CREATE TABLE IF NOT EXISTS code_blocks (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    block_type TEXT NOT NULL,
    language TEXT NOT NULL,
    symbol_name TEXT,
    parent_symbol TEXT,
    tokens INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(file_path, content_hash)
);

CREATE TABLE IF NOT EXISTS files (
    file_path TEXT PRIMARY KEY,
    file_hash TEXT NOT NULL,
    language TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    line_count INTEGER NOT NULL,
    last_indexed INTEGER NOT NULL,
    block_count INTEGER NOT NULL,
    is_deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS search_stats (
    query_hash TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    result_count INTEGER NOT NULL,
    avg_score REAL NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_file_path ON code_blocks(file_path);
CREATE INDEX IF NOT EXISTS idx_blocks_type ON code_blocks(block_type);
CREATE INDEX IF NOT EXISTS idx_blocks_language ON code_blocks(language);
CREATE INDEX IF NOT EXISTS idx_blocks_symbol ON code_blocks(symbol_name);
CREATE INDEX IF NOT EXISTS idx_blocks_content_hash ON code_blocks(content_hash);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
CREATE INDEX IF NOT EXISTS idx_files_last_indexed ON files(last_indexed);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_stats(timestamp);

CREATE VIRTUAL TABLE IF NOT EXISTS code_fts USING fts5(
    block_id UNINDEXED,
    file_path,
    content,
    symbol_name,
    tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS vector_map (
    label INTEGER PRIMARY KEY,
    block_id TEXT NOT NULL,
    UNIQUE(block_id)
);
`;

export const insertInitialMetadataSQL = `
INSERT OR IGNORE INTO metadata (key, value) VALUES 
  ('schema_version', '${SCHEMA_VERSION}'),
  ('created_at', ?),
  ('last_migration', '${SCHEMA_VERSION}');
`;

export interface CodeBlock {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  contentHash: string;
  blockType: string;
  language: string;
  symbolName?: string;
  parentSymbol?: string;
  tokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface FileMetadata {
  filePath: string;
  fileHash: string;
  language: string;
  sizeBytes: number;
  lineCount: number;
  lastIndexed: number;
  blockCount: number;
  isDeleted?: boolean;
}

export interface SearchStats {
  queryHash: string;
  query: string;
  resultCount: number;
  avgScore: number;
  executionTimeMs: number;
  timestamp: number;
}
