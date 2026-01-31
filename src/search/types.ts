export interface SearchResult {
  blockId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  semanticScore: number;
  keywordScore: number;
  boostScore: number;
  finalScore: number;
  language: string;
  blockType: string;
  symbolName?: string;
  parentSymbol?: string;
}

export interface SearchOptions {
  limit: number;
  language?: string;
  blockType?: string;
  minScore?: number;
  semanticOnly?: boolean;
  keywordOnly?: boolean;
  expandQuery?: boolean;
}

export interface HybridSearchOptions extends SearchOptions {
  semanticWeight?: number;
  keywordWeight?: number;
  rerank?: boolean;
}

export interface QueryExpansionResult {
  original: string;
  expanded: string[];
}
