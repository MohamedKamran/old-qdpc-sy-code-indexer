import * as fs from 'fs/promises';
import * as path from 'path';
import Parser from 'tree-sitter';
import { ChunkingStrategy, CodeBlock } from './ChunkingStrategy';

export interface ParsedFile {
  filePath: string;
  language: string;
  blocks: CodeBlock[];
  lineCount: number;
  sizeBytes: number;
}

export class CodeParser {
  private chunkingStrategy: ChunkingStrategy;

  constructor(chunkingStrategy: ChunkingStrategy) {
    this.chunkingStrategy = chunkingStrategy;
  }

  async parseFile(filePath: string): Promise<ParsedFile> {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const language = this.detectLanguage(ext);
    const content = await fs.readFile(filePath, 'utf-8');
    
    const parser = new Parser();
    const tree = parser.parse(content);
    const blocks = this.chunkingStrategy.chunkFile(
      filePath,
      content,
      tree.rootNode,
      language
    );

    return {
      filePath,
      language,
      blocks,
      lineCount: content.split('\n').length,
      sizeBytes: Buffer.byteLength(content, 'utf-8')
    };
  }

  async parseFiles(filePaths: string[]): Promise<ParsedFile[]> {
    const results: ParsedFile[] = [];
    
    for (const filePath of filePaths) {
      try {
        const parsed = await this.parseFile(filePath);
        results.push(parsed);
      } catch (error) {
        console.error(`Failed to parse ${filePath}:`, error);
      }
    }

    return results;
  }

  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      mjs: 'javascript',
      cjs: 'javascript',
    };

    return langMap[ext] || ext;
  }
}
