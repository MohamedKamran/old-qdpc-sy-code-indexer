import { ConfigManager } from '../core/ConfigManager';
import { VectorStore } from '../storage/VectorStore';
import { OllamaEmbedder } from '../embedders/OllamaEmbedder';
import type { IEmbedder } from '../embedders/EmbedderInterface';
import { SearchResult, SearchOptions } from './types';

export class SemanticSearch {
  private configManager: ConfigManager;
  private vectorStore: VectorStore;
  private embedder: IEmbedder;

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
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.embedder.initialize();
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    await this.initialize();

    const embedding = await this.embedder.embed(query);
    const efSearch = this.configManager.get('performance').hnswEfSearch;
    const knnResults = this.vectorStore.searchKNN(embedding, options.limit * 2, efSearch);

    const results: SearchResult[] = [];

    for (const result of knnResults) {
      const block = this.vectorStore.getCodeBlock(this.labelToId(result.label));
      
      if (block) {
        const score = 1 - result.distance;
        
        if (options.minScore && score < options.minScore) {
          continue;
        }

        if (options.language && block.language.toLowerCase() !== options.language.toLowerCase()) {
          continue;
        }

        if (options.blockType && block.blockType.toLowerCase() !== options.blockType.toLowerCase()) {
          continue;
        }

        results.push({
          blockId: block.id,
          filePath: block.filePath,
          content: block.content,
          startLine: block.startLine,
          endLine: block.endLine,
          semanticScore: score,
          keywordScore: 0,
          boostScore: 1,
          finalScore: score,
          language: block.language,
          blockType: block.blockType,
          symbolName: block.symbolName,
          parentSymbol: block.parentSymbol
        });
      }
    }

    return results.slice(0, options.limit);
  }

  private labelToId(label: number): string {
    return label.toString(36);
  }

  dispose(): void {
    this.vectorStore.close();
    this.embedder.dispose();
  }
}
