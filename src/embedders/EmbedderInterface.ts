export interface Embedding {
  vector: Float32Array;
  dimensions: number;
}

export interface EmbedderOptions {
  model?: string;
  dimensions?: number;
  quantize?: boolean;
  device?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface IEmbedder {
  initialize(): Promise<void>;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  getDimensions(): number;
  getModelName(): string;
  dispose(): Promise<void>;
}
