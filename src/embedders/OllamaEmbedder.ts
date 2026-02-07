import { IEmbedder, EmbedderOptions } from './EmbedderInterface.js';

interface OllamaEmbeddingResponse {
  embedding: number[];
}

export class OllamaEmbedder implements IEmbedder {
  private baseUrl: string;
  private modelName: string;
  private dimensions: number;
  private cache: Map<string, Float32Array>;
  private initialized: boolean = false;

  constructor(options: EmbedderOptions & { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.modelName = options.model || 'nomic-embed-text';
    this.dimensions = options.dimensions || 768;
    this.cache = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama not reachable at ${this.baseUrl}`);
      }

      const models = await response.json();
      const modelExists = models.models?.some((m: { name: string }) => 
        m.name.startsWith(this.modelName)
      );

      if (!modelExists) {
        console.log(`Warning: Model '${this.modelName}' not found in Ollama. It will be pulled on first use.`);
      }

      this.initialized = true;
      console.log(`Ollama embedder initialized: ${this.baseUrl} with model '${this.modelName}'`);
    } catch (error) {
      throw new Error(`Failed to initialize Ollama embedder: ${error}`);
    }
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.initialized) {
      throw new Error('Embedder not initialized. Call initialize() first.');
    }

    // Truncate text to prevent context length errors (nomic-embed-text has ~8k token limit)
    const truncatedText = this.truncateText(text, 2000);

    const hash = this.hashText(truncatedText);
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelName,
          prompt: truncatedText
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error}`);
      }

      const data = await response.json() as OllamaEmbeddingResponse;
      const embedding = new Float32Array(data.embedding);

      this.cache.set(hash, embedding);

      if (this.cache.size > 10000) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }

      return embedding;
    } catch (error) {
      throw new Error(`Failed to embed text: ${error}`);
    }
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.initialized) {
      throw new Error('Embedder not initialized. Call initialize() first.');
    }

    const batchSize = 32;
    const results: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(async (text, idx) => {
          try {
            return await this.embed(text);
          } catch (error) {
            console.warn(`Failed to embed text block ${i + idx}: ${error}`);
            // Return zero vector as fallback
            return new Float32Array(this.dimensions).fill(0);
          }
        })
      );
      results.push(...batchEmbeddings);
    }

    return results;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.modelName;
  }

  async dispose(): Promise<void> {
    this.cache.clear();
    this.initialized = false;
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private truncateText(text: string, maxTokens: number): string {
    // Rough approximation: 1 token ≈ 4 characters
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    
    // Truncate and try to end at a line boundary
    const truncated = text.slice(0, maxChars);
    const lastNewline = truncated.lastIndexOf('\n');
    
    if (lastNewline > maxChars * 0.8) {
      return truncated.slice(0, lastNewline);
    }
    
    return truncated;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
