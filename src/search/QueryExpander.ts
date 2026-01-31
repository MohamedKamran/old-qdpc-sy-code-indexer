import { QueryExpansionResult } from './types';

export class QueryExpander {
  private programmingSynonyms: Record<string, string[]> = {
    'auth': ['authentication', 'authorize', 'login', 'signin', 'credential'],
    'fetch': ['get', 'retrieve', 'load', 'request', 'api'],
    'error': ['exception', 'failure', 'problem', 'issue'],
    'user': ['account', 'profile', 'member', 'person'],
    'data': ['info', 'information', 'record', 'entry'],
    'create': ['add', 'new', 'insert', 'make'],
    'update': ['edit', 'modify', 'change', 'patch'],
    'delete': ['remove', 'destroy', 'erase', 'clear'],
    'find': ['search', 'locate', 'lookup', 'query'],
    'list': ['array', 'collection', 'items', 'elements'],
    'render': ['display', 'show', 'view', 'draw'],
    'connect': ['join', 'link', 'attach', 'bind'],
    'send': ['transmit', 'post', 'push', 'emit'],
    'receive': ['get', 'accept', 'obtain', 'collect']
  };

  private codePatterns: Record<string, string[]> = {
    'error handler': ['try catch', 'try/catch', 'error handling', 'exception handling', 'catch block'],
    'async function': ['promise', 'async/await', 'callback', 'future', 'coroutine'],
    'http request': ['fetch', 'axios', 'xhr', 'ajax', 'api call', 'http client'],
    'component': ['react component', 'vue component', 'element', 'widget', 'view'],
    'hook': ['useeffect', 'usestate', 'custom hook', 'lifecycle'],
    'middleware': ['interceptor', 'filter', 'handler', 'plugin'],
    'router': ['routing', 'navigation', 'routes', 'paths', 'url handling']
  };

  async expand(query: string): Promise<QueryExpansionResult> {
    const expanded = new Set<string>([query.toLowerCase()]);

    const camelCaseWords = this.splitCamelCase(query);
    camelCaseWords.forEach(word => expanded.add(word.toLowerCase()));

    const normalized = this.expandProgrammingTerms(query);
    normalized.forEach(term => expanded.add(term));

    const synonyms = this.getSynonyms(query);
    synonyms.forEach(syn => expanded.add(syn));

    const patterns = this.matchCodePatterns(query);
    patterns.forEach(pattern => expanded.add(pattern));

    const snakeCaseWords = this.splitSnakeCase(query);
    snakeCaseWords.forEach(word => expanded.add(word.toLowerCase()));

    return {
      original: query,
      expanded: Array.from(expanded)
    };
  }

  private splitCamelCase(text: string): string[] {
    const words: string[] = [];
    let currentWord = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === char.toUpperCase() && currentWord.length > 0) {
        words.push(currentWord);
        currentWord = char;
      } else {
        currentWord += char;
      }
    }

    if (currentWord) {
      words.push(currentWord);
    }

    return words;
  }

  private splitSnakeCase(text: string): string[] {
    return text.split(/[_\s-]+/).filter(w => w.length > 0);
  }

  private expandProgrammingTerms(term: string): string[] {
    const expanded: string[] = [];
    const lowerTerm = term.toLowerCase();

    for (const [key, synonyms] of Object.entries(this.programmingSynonyms)) {
      if (lowerTerm.includes(key) || synonyms.some(s => lowerTerm.includes(s))) {
        expanded.push(key);
        expanded.push(...synonyms);
      }
    }

    return expanded;
  }

  private getSynonyms(term: string): string[] {
    const lowerTerm = term.toLowerCase();
    const synonyms: string[] = [];

    for (const [key, values] of Object.entries(this.programmingSynonyms)) {
      if (values.includes(lowerTerm) || key === lowerTerm) {
        synonyms.push(...values);
      }
    }

    return synonyms;
  }

  private matchCodePatterns(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const patterns: string[] = [];

    for (const [pattern, variations] of Object.entries(this.codePatterns)) {
      if (lowerQuery.includes(pattern)) {
        patterns.push(pattern);
        patterns.push(...variations);
      }
    }

    return patterns;
  }
}
