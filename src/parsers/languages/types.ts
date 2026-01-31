export interface LanguageSupport {
  name: string;
  extensions: string[];
  parser: string;
  chunkingRules: ChunkingRule[];
}

export interface ChunkingRule {
  nodeType: string;
  preserveBoundary: boolean;
  includeParents: string[];
  excludeNodes: string[];
}

export const LANGUAGE_CONFIGS: Record<string, LanguageSupport> = {
  typescript: {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    parser: 'typescript',
    chunkingRules: [
      {
        nodeType: 'function_declaration',
        preserveBoundary: true,
        includeParents: [],
        excludeNodes: ['comment']
      },
      {
        nodeType: 'class_declaration',
        preserveBoundary: true,
        includeParents: [],
        excludeNodes: ['comment']
      },
      {
        nodeType: 'interface_declaration',
        preserveBoundary: true,
        includeParents: [],
        excludeNodes: ['comment']
      },
      {
        nodeType: 'method_definition',
        preserveBoundary: true,
        includeParents: ['class_declaration'],
        excludeNodes: ['comment']
      }
    ]
  },
  javascript: {
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    parser: 'javascript',
    chunkingRules: [
      {
        nodeType: 'function_declaration',
        preserveBoundary: true,
        includeParents: [],
        excludeNodes: ['comment']
      },
      {
        nodeType: 'class_declaration',
        preserveBoundary: true,
        includeParents: [],
        excludeNodes: ['comment']
      },
      {
        nodeType: 'method_definition',
        preserveBoundary: true,
        includeParents: ['class_declaration'],
        excludeNodes: ['comment']
      }
    ]
  },
  python: {
    name: 'Python',
    extensions: ['.py'],
    parser: 'python',
    chunkingRules: [
      {
        nodeType: 'function_definition',
        preserveBoundary: true,
        includeParents: ['class_definition'],
        excludeNodes: ['comment', 'string']
      },
      {
        nodeType: 'class_definition',
        preserveBoundary: true,
        includeParents: [],
        excludeNodes: ['comment', 'string']
      }
    ]
  }
};

export function getLanguageConfig(extension: string): LanguageSupport | undefined {
  const ext = extension.toLowerCase();
  return Object.values(LANGUAGE_CONFIGS).find(config =>
    config.extensions.some(e => e === ext)
  );
}

export function getLanguageFromExtension(extension: string): string | undefined {
  const config = getLanguageConfig(extension);
  return config?.name.toLowerCase();
}
