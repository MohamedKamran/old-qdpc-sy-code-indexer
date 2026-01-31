import { SearchResult } from './types';

export class BoostCalculator {
  private languageDistribution: Record<string, number> = {};
  private recentFiles: Set<string> = new Set();

  setLanguageDistribution(distribution: Record<string, number>): void {
    this.languageDistribution = distribution;
  }

  setRecentFiles(files: string[]): void {
    this.recentFiles = new Set(files);
  }

  calculateBoost(result: SearchResult, query: string): number {
    let boost = 1.0;

    boost *= this.calculateSymbolNameBoost(result, query);
    boost *= this.calculateFilePathBoost(result, query);
    boost *= this.calculateRecencyBoost(result);
    boost *= this.calculateBlockTypeBoost(result);
    boost *= this.calculateLanguageBoost(result);
    boost *= this.calculateSemanticKeywordBalance(result);

    return boost;
  }

  private calculateSymbolNameBoost(result: SearchResult, query: string): number {
    if (!result.symbolName) return 1.0;

    const queryLower = query.toLowerCase();
    const symbolLower = result.symbolName.toLowerCase();

    if (symbolLower === queryLower) {
      return 1.5;
    } else if (symbolLower.includes(queryLower)) {
      return 1.3;
    } else if (queryLower.includes(symbolLower)) {
      return 1.2;
    }

    return 1.0;
  }

  private calculateFilePathBoost(result: SearchResult, query: string): number {
    const queryLower = query.toLowerCase();
    const filePathLower = result.filePath.toLowerCase();

    if (filePathLower.includes(queryLower)) {
      return 1.3;
    }

    const fileName = filePathLower.split('/').pop() || '';
    if (fileName.includes(queryLower)) {
      return 1.2;
    }

    return 1.0;
  }

  private calculateRecencyBoost(result: SearchResult): number {
    if (this.recentFiles.has(result.filePath)) {
      return 1.25;
    }

    return 1.0;
  }

  private calculateBlockTypeBoost(result: SearchResult): number {
    const typeBoosts: Record<string, number> = {
      'function_declaration': 1.3,
      'function_expression': 1.3,
      'arrow_function': 1.3,
      'method_definition': 1.3,
      'function_definition': 1.3,
      'class_declaration': 1.2,
      'class_expression': 1.2,
      'class_definition': 1.2,
      'interface_declaration': 1.15,
      'type_alias_declaration': 1.15,
      'enum_declaration': 1.1,
      'decorated_definition': 1.25,
      'file': 0.95
    };

    return typeBoosts[result.blockType] || 1.0;
  }

  private calculateLanguageBoost(result: SearchResult): number {
    if (Object.keys(this.languageDistribution).length === 0) {
      return 1.0;
    }

    const langCount = this.languageDistribution[result.language] || 0;
    const totalFiles = Object.values(this.languageDistribution).reduce((sum, count) => sum + count, 0);
    const percentage = langCount / totalFiles;

    if (percentage > 0.5) {
      return 1.1;
    } else if (percentage > 0.2) {
      return 1.05;
    } else if (percentage < 0.05) {
      return 0.95;
    }

    return 1.0;
  }

  private calculateSemanticKeywordBalance(result: SearchResult): number {
    if (result.semanticScore > 0.7 && result.keywordScore > 0.7) {
      return 1.2;
    } else if (result.semanticScore > 0.8 || result.keywordScore > 0.8) {
      return 1.1;
    } else if (result.semanticScore < 0.3 && result.keywordScore < 0.3) {
      return 0.8;
    }

    return 1.0;
  }

  calculateExactMatchBoost(result: SearchResult, query: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = result.content.toLowerCase();

    if (contentLower.includes(queryLower)) {
      const occurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
      return 1 + (occurrences * 0.05);
    }

    return 1.0;
  }

  calculateSizeBoost(result: SearchResult): number {
    const lineCount = result.endLine - result.startLine;

    if (lineCount < 10) {
      return 0.95;
    } else if (lineCount > 100) {
      return 0.9;
    } else if (lineCount > 200) {
      return 0.85;
    }

    return 1.0;
  }
}
