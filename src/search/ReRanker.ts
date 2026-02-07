import { SearchResult } from './types.js';

export class ReRanker {
  async rerank(results: SearchResult[], query: string): Promise<SearchResult[]> {
    if (results.length <= 1) {
      return results;
    }

    const scored = results.map(result => ({
      result,
      rerankScore: this.calculateRerankScore(result, query)
    }));

    const reranked = scored.sort((a, b) => b.rerankScore - a.rerankScore);

    return reranked.map(item => ({
      ...item.result,
      finalScore: item.rerankScore
    }));
  }

  private calculateRerankScore(result: SearchResult, query: string): number {
    let score = result.finalScore;

    const queryLower = query.toLowerCase();
    const contentLower = result.content.toLowerCase();
    const symbolLower = (result.symbolName || '').toLowerCase();

    if (symbolLower === queryLower) {
      score *= 1.5;
    } else if (symbolLower.includes(queryLower)) {
      score *= 1.2;
    }

    const exactMatch = contentLower.includes(queryLower);
    if (exactMatch) {
      score *= 1.1;
    }

    const wordMatches = this.countWordMatches(queryLower, contentLower);
    if (wordMatches > 0) {
      score *= (1 + wordMatches * 0.05);
    }

    if (result.semanticScore > 0.8 && result.keywordScore > 0.5) {
      score *= 1.15;
    }

    if (result.blockType === 'function_declaration' || 
        result.blockType === 'method_definition' ||
        result.blockType === 'function_definition') {
      score *= 1.05;
    }

    if (result.content.split('\n').length > 50) {
      score *= 0.95;
    }

    return Math.min(score, 1);
  }

  private countWordMatches(query: string, content: string): number {
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    let matches = 0;

    for (const word of queryWords) {
      if (content.includes(word)) {
        matches++;
      }
    }

    return matches;
  }

  async rerankBatch(results: SearchResult[], queries: string[]): Promise<SearchResult[][]> {
    return Promise.all(
      queries.map(query => this.rerank(results, query))
    );
  }
}
