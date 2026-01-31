import { SyntaxNode } from 'tree-sitter';
import crypto from 'crypto';

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

export interface ChunkingOptions {
  targetTokens: number;
  maxTokens: number;
  overlapTokens: number;
  preserveFunctionBoundaries: boolean;
  preserveClassBoundaries: boolean;
  includeParentContext: boolean;
}

const DEFAULT_OPTIONS: ChunkingOptions = {
  targetTokens: 512,
  maxTokens: 2048,
  overlapTokens: 50,
  preserveFunctionBoundaries: true,
  preserveClassBoundaries: true,
  includeParentContext: true
};

export class ChunkingStrategy {
  private options: ChunkingOptions;

  constructor(options: Partial<ChunkingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  chunkFile(
    filePath: string,
    content: string,
    rootNode: SyntaxNode,
    language: string
  ): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = content.split('\n');

    const processNode = (node: SyntaxNode, parentSymbol?: string) => {
      const nodeType = node.type;

      if (this.isSemanticBlock(node, language)) {
        const block = this.createSemanticBlock(
          node,
          filePath,
          content,
          language,
          parentSymbol
        );
        if (block) {
          blocks.push(block);
        }

        const symbolName = this.extractSymbolName(node, nodeType);
        for (const child of node.children) {
          if (!this.isSemanticBlock(child, language)) {
            processNode(child, symbolName);
          }
        }
      } else {
        for (const child of node.children) {
          processNode(child, parentSymbol);
        }
      }
    };

    processNode(rootNode);

    if (blocks.length === 0) {
      blocks.push(this.createFileBlock(filePath, content, language));
    }

    return blocks;
  }

  private isSemanticBlock(node: SyntaxNode, language: string): boolean {
    const semanticTypes: Record<string, string[]> = {
      typescript: [
        'function_declaration',
        'function_expression',
        'arrow_function',
        'class_declaration',
        'class_expression',
        'method_definition',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration'
      ],
      javascript: [
        'function_declaration',
        'function_expression',
        'arrow_function',
        'class_declaration',
        'class_expression',
        'method_definition'
      ],
      python: [
        'function_definition',
        'class_definition',
        'decorated_definition'
      ]
    };

    const types = semanticTypes[language] || semanticTypes.javascript;
    return types.includes(node.type);
  }

  private createSemanticBlock(
    node: SyntaxNode,
    filePath: string,
    content: string,
    language: string,
    parentSymbol?: string
  ): CodeBlock | null {
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;
    const nodeContent = this.extractNodeContent(content, node);
    
    const tokens = this.estimateTokens(nodeContent);
    if (tokens > this.options.maxTokens) {
      return this.chunkLargeNode(node, filePath, content, language, parentSymbol);
    }

    const blockType = node.type;
    const symbolName = this.extractSymbolName(node, blockType);
    const contentHash = this.hashContent(nodeContent);
    const now = Date.now();

    return {
      id: this.generateId(filePath, startLine, endLine, blockType),
      filePath,
      startLine: startLine + 1,
      endLine: endLine + 1,
      content: nodeContent,
      contentHash,
      blockType,
      language,
      symbolName,
      parentSymbol,
      tokens,
      createdAt: now,
      updatedAt: now
    };
  }

  private chunkLargeNode(
    node: SyntaxNode,
    filePath: string,
    content: string,
    language: string,
    parentSymbol?: string
  ): CodeBlock {
    const blocks: CodeBlock[] = [];
    const lines = content.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;
    const blockType = node.type;
    const symbolName = this.extractSymbolName(node, blockType);
    
    let currentLine = startLine;
    let lastChunkEnd = startLine;

    while (currentLine <= endLine) {
      let chunkSize = 0;
      let chunkEnd = currentLine;

      while (chunkEnd <= endLine && chunkSize < this.options.targetTokens) {
        const lineContent = lines[chunkEnd] || '';
        chunkSize += this.estimateTokens(lineContent);
        chunkEnd++;
      }

      const chunkContent = lines.slice(
        Math.max(currentLine - this.options.overlapTokens, lastChunkEnd),
        Math.min(chunkEnd + this.options.overlapTokens, endLine + 1)
      ).join('\n');

      const contentHash = this.hashContent(chunkContent);
      const now = Date.now();

      blocks.push({
        id: this.generateId(filePath, currentLine, chunkEnd, blockType, blocks.length),
        filePath,
        startLine: Math.max(currentLine - this.options.overlapTokens, lastChunkEnd) + 1,
        endLine: Math.min(chunkEnd + this.options.overlapTokens, endLine + 1) + 1,
        content: chunkContent,
        contentHash,
        blockType,
        language,
        symbolName,
        parentSymbol,
        tokens: this.estimateTokens(chunkContent),
        createdAt: now,
        updatedAt: now
      });

      lastChunkEnd = chunkEnd;
      currentLine = chunkEnd;
    }

    return blocks[0];
  }

  private createFileBlock(
    filePath: string,
    content: string,
    language: string
  ): CodeBlock {
    const lines = content.split('\n');
    const contentHash = this.hashContent(content);
    const now = Date.now();

    return {
      id: this.generateId(filePath, 0, lines.length, 'file'),
      filePath,
      startLine: 1,
      endLine: lines.length,
      content,
      contentHash,
      blockType: 'file',
      language,
      tokens: this.estimateTokens(content),
      createdAt: now,
      updatedAt: now
    };
  }

  private extractNodeContent(content: string, node: SyntaxNode): string {
    const lines = content.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private extractSymbolName(node: SyntaxNode, nodeType: string): string | undefined {
    const identifierTypes = ['identifier', 'property_identifier'];
    
    for (const child of node.children) {
      if (identifierTypes.includes(child.type)) {
        return child.text;
      }
    }
    return undefined;
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private generateId(
    filePath: string,
    startLine: number,
    endLine: number,
    blockType: string,
    chunkIndex = 0
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${filePath}:${startLine}:${endLine}:${blockType}:${chunkIndex}`)
      .digest('hex')
      .substring(0, 16);
    return hash;
  }

  private estimateTokens(content: string): number {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    return Math.ceil(words.length * 0.75);
  }
}
