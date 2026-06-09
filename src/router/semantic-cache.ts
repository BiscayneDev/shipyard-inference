import OpenAI from 'openai'
import type { LLMChatParams, LLMResponse } from '../types.js'
import { type CacheStore, canonicalRequestText } from './cache.js'

/** Turns text into an embedding vector. Bring your own, or use `openAIEmbedder`. */
export interface Embedder {
  embed(text: string): Promise<number[]>
}

export interface SemanticCacheOptions {
  embedder: Embedder
  /** Cosine-similarity threshold for a hit (0–1). Default 0.95. */
  threshold?: number
  /** Max cached entries (FIFO eviction). Default 1000. */
  maxEntries?: number
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Semantic response cache: embeds each request and returns a stored response
 * when a prior request is similar enough (cosine ≥ `threshold`). Deduplicates
 * paraphrases that an exact-match cache would miss. Backed by an in-memory
 * vector list with a linear scan — fine for moderate volumes; swap in your own
 * `CacheStore` over a vector DB for large ones.
 */
export class SemanticCacheStore implements CacheStore {
  private readonly embedder: Embedder
  private readonly threshold: number
  private readonly maxEntries: number
  private entries: Array<{ vector: number[]; value: LLMResponse }> = []

  constructor(options: SemanticCacheOptions) {
    this.embedder = options.embedder
    this.threshold = options.threshold ?? 0.95
    this.maxEntries = options.maxEntries ?? 1000
  }

  async get(params: LLMChatParams): Promise<LLMResponse | undefined> {
    if (this.entries.length === 0) return undefined
    const query = await this.embedder.embed(canonicalRequestText(params))

    let best: { value: LLMResponse; score: number } | undefined
    for (const entry of this.entries) {
      const score = cosineSimilarity(query, entry.vector)
      if (!best || score > best.score) best = { value: entry.value, score }
    }
    return best && best.score >= this.threshold ? best.value : undefined
  }

  async set(params: LLMChatParams, value: LLMResponse): Promise<void> {
    const vector = await this.embedder.embed(canonicalRequestText(params))
    this.entries.push({ vector, value })
    while (this.entries.length > this.maxEntries) this.entries.shift()
  }
}

export interface OpenAIEmbedderOptions {
  apiKey?: string
  baseURL?: string
  /** Embedding model. Default `text-embedding-3-small`. */
  model?: string
}

/** An `Embedder` backed by the OpenAI embeddings API (reuses the `openai` dep). */
export function openAIEmbedder(options: OpenAIEmbedderOptions = {}): Embedder {
  const client = new OpenAI({
    apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
    baseURL: options.baseURL,
  })
  const model = options.model ?? 'text-embedding-3-small'
  return {
    async embed(text: string): Promise<number[]> {
      const res = await client.embeddings.create({ model, input: text })
      return res.data[0]!.embedding
    },
  }
}
