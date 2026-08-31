import type {
  MediaProvider,
  VideoQuoteParams,
  VideoQuoteResult,
  VideoQueueParams,
  VideoQueueResult,
  VideoRetrieveParams,
  VideoRetrieveResult,
  VideoCompleteParams,
} from '../types.js'

/**
 * Error thrown by `VeniceVideoProvider` when a Venice API request fails
 * (non-2xx status, network error, or unexpected response shape).
 */
export class VeniceVideoError extends Error {
  /** HTTP status code, if the error originated from an HTTP response. */
  readonly status?: number
  /** Raw response body text, if available. */
  readonly body?: string

  constructor(
    message: string,
    opts?: { status?: number; body?: string; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'VeniceVideoError'
    if (opts?.status !== undefined) this.status = opts.status
    if (opts?.body !== undefined) this.body = opts.body
  }
}

export interface VeniceVideoProviderOptions {
  /** Venice API key. Defaults to `VENICE_API_KEY`. */
  apiKey?: string
  /** Override the base URL. Defaults to `https://api.venice.ai/api/v1`. */
  baseURL?: string
  /**
   * Custom fetch implementation. The payment layer uses this to inject
   * `createPayingFetch`, so an HTTP 402 from the upstream is settled and
   * retried transparently — `queue()` / `retrieve()` never learn a payment
   * happened.
   */
  fetch?: typeof fetch
}

const DEFAULT_BASE_URL = 'https://api.venice.ai/api/v1'

/**
 * Venice async video generation provider.
 *
 * Venice's video API is an asynchronous queue: you submit a generation job
 * (`queue`), poll for completion (`retrieve`), acknowledge when done
 * (`complete`), and can get a cost estimate up-front (`quote`). This class
 * implements the `MediaProvider` interface against that API.
 *
 * @example
 *   const venice = new VeniceVideoProvider({ apiKey: process.env.VENICE_API_KEY })
 *   const { queueId } = await venice.video.queue({
 *     model: 'venice-video-v1',
 *     prompt: 'A cat playing piano on Mars',
 *     duration: 5,
 *     resolution: '720p',
 *   })
 *   // poll retrieve() until status === 'COMPLETED' …
 *   await venice.video.complete({ model: 'venice-video-v1', queueId })
 */
export class VeniceVideoProvider implements MediaProvider {
  private readonly apiKey: string
  private readonly baseURL: string
  private readonly fetchFn: typeof fetch

  readonly video: {
    quote?(params: VideoQuoteParams): Promise<VideoQuoteResult>
    queue(params: VideoQueueParams): Promise<VideoQueueResult>
    retrieve(params: VideoRetrieveParams): Promise<VideoRetrieveResult>
    complete?(params: VideoCompleteParams): Promise<void>
  }

  constructor(options: VeniceVideoProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.VENICE_API_KEY ?? ''
    if (!this.apiKey) {
      throw new Error(
        '[shipyard-inference] VeniceVideoProvider requires `apiKey` (or VENICE_API_KEY). ' +
          'Get one at https://venice.ai',
      )
    }
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.fetchFn = options.fetch ?? globalThis.fetch

    // Bind the methods so they can be destructured / passed around safely.
    this.video = {
      quote: this.quote.bind(this),
      queue: this.queue.bind(this),
      retrieve: this.retrieve.bind(this),
      complete: this.complete.bind(this),
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async postJSON<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseURL}${path}`
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let bodyText: string | undefined
      try {
        bodyText = await response.text()
      } catch {
        // Ignore — body may already be consumed or unavailable.
      }
      throw new VeniceVideoError(
        `Venice API ${path} failed: ${response.status} ${response.statusText}`,
        { status: response.status, body: bodyText },
      )
    }

    return response.json() as Promise<T>
  }

  // -------------------------------------------------------------------------
  // MediaProvider.video implementation
  // -------------------------------------------------------------------------

  async quote(params: VideoQuoteParams): Promise<VideoQuoteResult> {
    const body: Record<string, unknown> = {
      model: params.model,
      duration: params.duration,
      resolution: params.resolution,
    }
    const result = await this.postJSON<{ quote: number }>('/video/quote', body)
    return { quote: result.quote }
  }

  async queue(params: VideoQueueParams): Promise<VideoQueueResult> {
    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
      duration: params.duration,
      resolution: params.resolution,
    }
    if (params.aspectRatio !== undefined) body.aspect_ratio = params.aspectRatio
    if (params.image_url !== undefined) body.image_url = params.image_url

    const result = await this.postJSON<{
      model: string
      queue_id: string
      download_url?: string
    }>('/video/queue', body)

    return {
      model: result.model,
      queueId: result.queue_id,
      downloadUrl: result.download_url,
    }
  }

  async retrieve(
    params: VideoRetrieveParams,
  ): Promise<VideoRetrieveResult> {
    const url = `${this.baseURL}/video/retrieve`
    const body: Record<string, unknown> = {
      model: params.model,
      queue_id: params.queueId,
    }

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let bodyText: string | undefined
      try {
        bodyText = await response.text()
      } catch {
        // Ignore.
      }
      throw new VeniceVideoError(
        `Venice API /video/retrieve failed: ${response.status} ${response.statusText}`,
        { status: response.status, body: bodyText },
      )
    }

    const contentType = response.headers.get('content-type') ?? ''

    // Case 1: inline binary video — the response body IS the MP4.
    // Venice returns the raw video bytes with Content-Type: video/mp4.
    if (contentType.includes('video/')) {
      const videoBuffer = await response.arrayBuffer()
      const videoData = uint8ArrayToBase64(new Uint8Array(videoBuffer))
      return {
        status: 'COMPLETED',
        videoData,
      }
    }

    // Case 2: JSON status response (PROCESSING or COMPLETED).
    let json: Record<string, unknown>
    try {
      json = (await response.json()) as Record<string, unknown>
    } catch (err) {
      throw new VeniceVideoError(
        'Venice API /video/retrieve returned a non-JSON, non-video response',
        { cause: err },
      )
    }

    const status = json.status

    if (status === 'PROCESSING') {
      return {
        status: 'PROCESSING',
        averageExecutionTime:
          typeof json.average_execution_time === 'number'
            ? (json.average_execution_time as number)
            : undefined,
        executionDuration:
          typeof json.execution_duration === 'number'
            ? (json.execution_duration as number)
            : undefined,
      }
    }

    if (status === 'COMPLETED') {
      // For private models, the download URL was given at queue time and
      // may also be included in this response.
      const downloadUrl =
        typeof json.download_url === 'string'
          ? (json.download_url as string)
          : params.downloadUrl
      return {
        status: 'COMPLETED',
        downloadUrl,
      }
    }

    throw new VeniceVideoError(
      `Venice API /video/retrieve returned unexpected status: ${String(status)}`,
      { body: JSON.stringify(json) },
    )
  }

  async complete(params: VideoCompleteParams): Promise<void> {
    await this.postJSON<{ success: boolean }>('/video/complete', {
      model: params.model,
      queue_id: params.queueId,
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a `Uint8Array` to a base64 string without requiring Node.js
 * `Buffer` (works in both browser and Node >=20).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Node >=20 has global Buffer; fall back to btoa for browser/edge.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}
