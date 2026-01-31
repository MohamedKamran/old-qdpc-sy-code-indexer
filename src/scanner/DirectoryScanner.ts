import fs from 'fs/promises';
import path from 'path';
import ignore from 'ignore';

export interface ScanOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  followSymlinks?: boolean;
}

export interface ScanResult {
  files: string[];
  directories: string[];
  skipped: string[];
  errors: Array<{ path: string; error: string }>;
}

export class DirectoryScanner {
  private ignore: ReturnType<typeof ignore>;

  constructor(options: ScanOptions = {}) {
    this.ignore = ignore({
      ignorecase: false,
      allowRelativePaths: true
    });
    
    const defaultExcludes = [
      'node_modules',
      '.git',
      '.syntheo',
      'dist',
      'build',
      'coverage',
      '.next',
      '.nuxt',
      'target',
      'bin',
      'obj'
    ];
    
    this.ignore.add(defaultExcludes);
    
    if (options.excludePatterns) {
      this.ignore.add(options.excludePatterns);
    }
  }

  async scan(rootPath: string, options: ScanOptions = {}): Promise<ScanResult> {
    const result: ScanResult = {
      files: [],
      directories: [],
      skipped: [],
      errors: []
    };

    const maxDepth = options.maxDepth ?? 50;
    
    await this.scanDirectory(rootPath, rootPath, 0, maxDepth, result, options);
    
    return result;
  }

  private async scanDirectory(
    dirPath: string,
    rootPath: string,
    currentDepth: number,
    maxDepth: number,
    result: ScanResult,
    options: ScanOptions
  ): Promise<void> {
    if (currentDepth > maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (this.isIgnored(relativePath)) {
          result.skipped.push(relativePath);
          continue;
        }

        try {
          if (entry.isDirectory()) {
            if (options.followSymlinks !== false || !entry.isSymbolicLink()) {
              result.directories.push(relativePath);
              await this.scanDirectory(
                fullPath,
                rootPath,
                currentDepth + 1,
                maxDepth,
                result,
                options
              );
            }
          } else if (entry.isFile()) {
            if (this.shouldIncludeFile(fullPath, options)) {
              result.files.push(relativePath);
            } else {
              result.skipped.push(relativePath);
            }
          }
        } catch (error) {
          result.errors.push({
            path: relativePath,
            error: (error as Error).message
          });
        }
      }
    } catch (error) {
      result.errors.push({
        path: path.relative(rootPath, dirPath),
        error: (error as Error).message
      });
    }
  }

  private isIgnored(relativePath: string): boolean {
    return this.ignore.ignores(relativePath);
  }

  private shouldIncludeFile(filePath: string, options: ScanOptions): boolean {
    const ext = path.extname(filePath).toLowerCase();
    
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.java', '.go', '.rs', '.rb', '.php',
      '.cs', '.kt', '.swift', '.html', '.css', '.scss',
      '.sql', '.md', '.json', '.yaml', '.yml', '.xml'
    ];

    if (!codeExtensions.includes(ext)) {
      return false;
    }

    if (options.includePatterns) {
      return options.includePatterns.some(pattern => 
        filePath.includes(pattern) || path.basename(filePath).includes(pattern)
      );
    }

    return true;
  }

  async getFileStats(filePath: string): Promise<{
    size: number;
    modified: number;
    created: number;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        modified: stats.mtimeMs,
        created: stats.birthtimeMs
      };
    } catch (error) {
      throw new Error(`Failed to get file stats for ${filePath}: ${error}`);
    }
  }

  addIgnorePattern(pattern: string | string[]): void {
    this.ignore.add(pattern);
  }

  clearIgnorePatterns(): void {
    this.ignore = ignore();
  }
}
