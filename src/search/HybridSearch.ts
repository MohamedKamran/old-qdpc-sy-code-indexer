import { ConfigManager } from '../core/ConfigManager.js';
import { VectorStore } from '../storage/VectorStore.js';
import { OllamaEmbedder } from '../embedders/OllamaEmbedder.js';
import type { IEmbedder } from '../embedders/EmbedderInterface.js';
import { SearchResult, HybridSearchOptions } from './types.js';
import { ReRanker } from './ReRanker.js';
import { BoostCalculator } from './BoostCalculator.js';

export class HybridSearch {
  private configManager: ConfigManager;
  private vectorStore: VectorStore;
  private embedder: IEmbedder;
  private reRanker: ReRanker;
  private boostCalculator: BoostCalculator;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    
    const indexPath = configManager.getIndexPath();
    const embedderConfig = configManager.get('embedder');

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
    this.reRanker = new ReRanker();
    this.boostCalculator = new BoostCalculator();
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.embedder.initialize();
  }

  async search(query: string, options: HybridSearchOptions): Promise<SearchResult[]> {
    const startTime = Date.now();

    await this.initialize();

    const searchConfig = this.configManager.get('search');
    const semanticWeight = options.semanticWeight ?? searchConfig.hybridWeight.semantic;
    const keywordWeight = options.keywordWeight ?? searchConfig.hybridWeight.keyword;
    const efSearch = this.configManager.get('performance').hnswEfSearch;

    let semanticResults: SearchResult[] = [];
    let keywordResults: SearchResult[] = [];

    if (!options.keywordOnly) {
      semanticResults = await this.semanticSearch(query, options.limit, efSearch);
    }

    if (!options.semanticOnly) {
      keywordResults = await this.keywordSearch(query, options.limit);
    }

    const merged = this.mergeResults(
      semanticResults,
      keywordResults,
      semanticWeight,
      keywordWeight
    );

    const boosted = this.applyBoosts(merged, query);

    const filtered = this.applyFilters(boosted, options);

    const sorted = filtered.sort((a, b) => b.finalScore - a.finalScore);

    const limited = sorted.slice(0, options.limit);

    if (options.rerank ?? searchConfig.rerank) {
      const reranked = await this.reRanker.rerank(limited, query);
      return reranked;
    }

    const executionTime = Date.now() - startTime;
    
    this.vectorStore.recordSearchStats({
      queryHash: this.hashQuery(query),
      query,
      resultCount: limited.length,
      avgScore: limited.reduce((sum, r) => sum + r.finalScore, 0) / limited.length,
      executionTimeMs: executionTime,
      timestamp: Date.now()
    });

    return limited;
  }

  private async semanticSearch(query: string, limit: number, efSearch: number): Promise<SearchResult[]> {
    const embedding = await this.embedder.embed(query);
    const knnResults = this.vectorStore.searchKNN(embedding, limit * 2, efSearch);

    const results: SearchResult[] = [];

    for (const result of knnResults) {
      const blockId = this.vectorStore.labelToBlockId(result.label);
      if (!blockId) continue;
      
      const block = this.vectorStore.getCodeBlock(blockId);
      
      if (block) {
        results.push({
          blockId: block.id,
          filePath: block.filePath,
          content: block.content,
          startLine: block.startLine,
          endLine: block.endLine,
          semanticScore: 1 - result.distance,
          keywordScore: 0,
          boostScore: 1,
          finalScore: 1 - result.distance,
          language: block.language,
          blockType: block.blockType,
          symbolName: block.symbolName,
          parentSymbol: block.parentSymbol
        });
      }
    }

    return results;
  }

  private async keywordSearch(query: string, limit: number): Promise<SearchResult[]> {
    const ftsResults = this.vectorStore.fullTextSearch(query, limit * 2);

    const results: SearchResult[] = [];

    for (const result of ftsResults) {
      const block = this.vectorStore.getCodeBlock(result.blockId);
      
      if (block) {
        const normalizedScore = Math.min(result.score / 10, 1);
        
        results.push({
          blockId: block.id,
          filePath: block.filePath,
          content: block.content,
          startLine: block.startLine,
          endLine: block.endLine,
          semanticScore: 0,
          keywordScore: normalizedScore,
          boostScore: 1,
          finalScore: normalizedScore,
          language: block.language,
          blockType: block.blockType,
          symbolName: block.symbolName,
          parentSymbol: block.parentSymbol
        });
      }
    }

    return results;
  }

  private mergeResults(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    semanticWeight: number,
    keywordWeight: number
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    const totalWeight = semanticWeight + keywordWeight;

    for (const result of semanticResults) {
      const existing = merged.get(result.blockId);
      
      if (existing) {
        existing.semanticScore = Math.max(existing.semanticScore, result.semanticScore);
        existing.finalScore = 
          (existing.semanticScore * semanticWeight + existing.keywordScore * keywordWeight) / totalWeight;
      } else {
        result.finalScore = (result.semanticScore * semanticWeight) / totalWeight;
        merged.set(result.blockId, result);
      }
    }

    for (const result of keywordResults) {
      const existing = merged.get(result.blockId);
      
      if (existing) {
        existing.keywordScore = Math.max(existing.keywordScore, result.keywordScore);
        existing.finalScore = 
          (existing.semanticScore * semanticWeight + existing.keywordScore * keywordWeight) / totalWeight;
      } else {
        result.finalScore = (result.keywordScore * keywordWeight) / totalWeight;
        merged.set(result.blockId, result);
      }
    }

    return Array.from(merged.values());
  }

  private applyBoosts(results: SearchResult[], query: string): SearchResult[] {
    return results.map(result => {
      const boost = this.boostCalculator.calculateBoost(result, query);
      return {
        ...result,
        boostScore: boost,
        finalScore: result.finalScore * boost
      };
    });
  }

  private applyFilters(results: SearchResult[], options: HybridSearchOptions): SearchResult[] {
    let filtered = results;

    if (options.language) {
      filtered = filtered.filter(r => 
        r.language.toLowerCase() === options.language?.toLowerCase()
      );
    }

    if (options.blockType) {
      filtered = filtered.filter(r => 
        r.blockType.toLowerCase() === options.blockType?.toLowerCase()
      );
    }

    if (options.minScore) {
      filtered = filtered.filter(r => r.finalScore >= options.minScore!);
    }

    return filtered;
  }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  dispose(): void {
    this.vectorStore.close();
    this.embedder.dispose();
  }
}
