import * as fs from 'fs/promises';
import * as path from 'path';
import Parser from 'tree-sitter';
import { LanguageSupport } from './languages/types';
import * as TypeScript from 'tree-sitter-typescript';
import * as Python from 'tree-sitter-python';
import * as JavaScript from 'tree-sitter-javascript';
import { ChunkingStrategy, CodeBlock } from './ChunkingStrategy';

const LANGUAGE_MAP: Record<string, any> = {
  typescript: TypeScript,
  tsx: TypeScript,
  javascript: JavaScript,
  js: JavaScript,
  python: Python,
  py: Python,
};

export interface ParsedFile {
  filePath: string;
  language: string;
  blocks: CodeBlock[];
  lineCount: number;
  sizeBytes: number;
}

export class CodeParser {
  private parsers: Map<string, Parser> = new Map();
  private chunkingStrategy: ChunkingStrategy;

  constructor(chunkingStrategy: ChunkingStrategy) {
    this.chunkingStrategy = chunkingStrategy;
  }

  async parseFile(filePath: string): Promise<ParsedFile> {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const language = this.detectLanguage(filePath, ext);
    
    if (!language || !LANGUAGE_MAP[language]) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const parser = await this.getParser(language);
    const content = await fs.readFile(filePath, 'utf-8');
    
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

  private async getParser(language: string): Promise<Parser> {
    if (this.parsers.has(language)) {
      return this.parsers.get(language)!;
    }

    const parser = new Parser();
    const LangConstructor = LANGUAGE_MAP[language];
    
    if (typeof LangConstructor === 'function') {
      parser.setLanguage(LangConstructor());
    } else if (LangConstructor.default) {
      parser.setLanguage(LangConstructor.default());
    } else {
      throw new Error(`Invalid language module for: ${language}`);
    }

    this.parsers.set(language, parser);
    return parser;
  }

  private detectLanguage(filePath: string, ext: string): string | null {
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

  dispose(): void {
    for (const parser of this.parsers.values()) {
      parser.delete();
    }
    this.parsers.clear();
  }
}
