export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  /**
   * Images on a user message, in order after the text. `url` is an http(s)
   * URL or a `data:<mime>;base64,...` URI, passed to the provider untouched.
   */
  images?: ImagePart[]
  toolCalls?: ToolCall[]
  toolResults?: ToolCallResult[]
}

export interface ImagePart {
  url: string
  /** OpenAI's optional detail hint ('auto' | 'low' | 'high'). */
  detail?: string
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolCallResult {
  id: string
  result?: ToolResult
  error?: string
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * Optional hints that steer router model selection. Every field is optional and
 * additive: a caller that omits `routingHints` (or omits any individual field)
 * gets the pre-router behaviour unchanged. Hints are ignored by the leaf
 * providers (Anthropic/OpenAI/UsePod) — only `Router` reads them.
 */
export interface RoutingHints {
  /** Minimum quality tier the chosen model must meet. */
  tier?: 'economy' | 'standard' | 'frontier'
  /** Require a tool-capable model (implied when `tools` is non-empty). */
  requireTools?: boolean
  /** Require a vision-capable model. */
  requireVision?: boolean
  /** Require a context window of at least this many tokens. */
  minContextWindow?: number
  /** Hard override: skip selection and use this provider/model verbatim. */
  pin?: { provider?: string; model?: string }
  /** Reject any model whose output price exceeds this (USD per 1M tokens). */
  maxCostPerMTokOut?: number
  /** Free-form tags matched against a model's declared capabilities. */
  tags?: string[]
}

export interface LLMChatParams {
  system: string
  messages: ChatMessage[]
  tools: ToolDefinition[]
  model?: string
  maxTokens?: number
  /** Optional routing hints — read only by `Router`, ignored by leaf providers. */
  routingHints?: RoutingHints
  /**
   * Free-form per-request metadata for telemetry tagging (e.g. `{ userId }` to
   * attribute cost/savings per end user). Read only by `Router`'s usage
   * recorder; ignored by leaf providers.
   */
  metadata?: {
    userId?: string
    tenantId?: string
    projectId?: string
    apiKeyId?: string
    apiKeyLabel?: string
    /** Optional request class label for savings/reporting. */
    requestClass?: string
  } & Record<string, unknown>
}

/** Token accounting for a single completion, when the upstream reports it. */
export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  /** Prompt tokens served from the provider's cache, when reported. */
  cacheReadTokens?: number
  /** Prompt tokens written to the provider's cache, when reported. */
  cacheWriteTokens?: number
}

export interface LLMResponse {
  content: string | null
  toolCalls: ToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
  /** Token usage from the upstream, when available. Optional — some proxies strip it. */
  usage?: UsageInfo
}

/** A streamed text fragment. */
export interface LLMStreamTextDelta {
  type: 'text_delta'
  text: string
}
/** A tool call begins. `index` is a stable 0-based position in the final `toolCalls`. */
export interface LLMStreamToolCallStart {
  type: 'tool_call_start'
  index: number
  id: string
  name: string
}
/** A fragment of a tool call's argument JSON. Raw text — NOT valid JSON on its own. */
export interface LLMStreamToolCallDelta {
  type: 'tool_call_delta'
  index: number
  argsTextDelta: string
}
/** Terminal event. The only authoritative source of the full response, usage, and stopReason. */
export interface LLMStreamDone {
  type: 'done'
  response: LLMResponse
}
export type LLMStreamEvent =
  | LLMStreamTextDelta
  | LLMStreamToolCallStart
  | LLMStreamToolCallDelta
  | LLMStreamDone

export interface LLMStreamOptions {
  /** Abort the upstream request (e.g. on client disconnect) to stop token spend. */
  signal?: AbortSignal
}

export interface LLMProvider {
  chat(params: LLMChatParams): Promise<LLMResponse>
  /**
   * Optional streaming variant. Yields incremental events ending in a single
   * `done` event carrying the assembled `LLMResponse`. Optional so existing
   * implementers remain valid; `Router` adapts non-streaming providers.
   */
  chatStream?(
    params: LLMChatParams,
    opts?: LLMStreamOptions,
  ): AsyncIterable<LLMStreamEvent>
}

// ---------------------------------------------------------------------------
// Video generation types
// ---------------------------------------------------------------------------

/** Parameters for quoting a video generation job. */
export interface VideoQuoteParams {
  model: string
  /** Desired clip duration in seconds. */
  duration?: number
  /** Desired resolution, e.g. `720p`, `1080p`. */
  resolution?: string
}

/** Result of quoting a video generation job. */
export interface VideoQuoteResult {
  /** Estimated cost in USD. */
  quote: number
}

/** Parameters for enqueueing a video generation job. */
export interface VideoQueueParams {
  model: string
  prompt: string
  /** Desired clip duration in seconds. */
  duration?: number
  /** Desired resolution, e.g. `720p`, `1080p`. */
  resolution?: string
  /** Aspect ratio, e.g. `16:9`, `9:16`, `1:1`. */
  aspectRatio?: string
  /** Optional image-to-video reference (URL or data URI). */
  image_url?: string
  /** Optional routing hints — same semantics as `LLMChatParams.routingHints`. */
  routingHints?: RoutingHints
  /** Free-form per-request metadata for telemetry tagging. */
  metadata?: Record<string, unknown>
}

/** Result of enqueueing a video generation job. */
export interface VideoQueueResult {
  model: string
  queueId: string
  /** Direct download URL if the provider returns one immediately. */
  downloadUrl?: string
}

/** Status of a video generation job. */
export type VideoStatus = 'PROCESSING' | 'COMPLETED'

/** Parameters for retrieving the status/result of a video generation job. */
export interface VideoRetrieveParams {
  model: string
  queueId: string
  downloadUrl?: string
}

/** Result of retrieving a video generation job. */
export interface VideoRetrieveResult {
  status: VideoStatus
  /** Base64-encoded or raw video data, when available. */
  videoData?: string
  downloadUrl?: string
  /** Provider-reported average execution time (ms). */
  averageExecutionTime?: number
  /** Wall-clock execution duration for this specific job (ms). */
  executionDuration?: number
}

/** Parameters for marking a video generation job as complete / cancelling it. */
export interface VideoCompleteParams {
  model: string
  queueId: string
}

/**
 * High-level convenience parameters that enqueue + poll until the video is
 * ready, returning the final result in one call.
 */
export interface VideoGenerateParams extends VideoQueueParams {
  /** Milliseconds between polls. */
  pollIntervalMs?: number
  /** Maximum number of poll attempts before giving up. */
  maxPollAttempts?: number
}

/** Final result of a `video.generate()` call. */
export interface VideoGenerateResult {
  model: string
  queueId: string
  /** Base64-encoded or raw video data, when available. */
  videoData?: string
  downloadUrl?: string
  /** Estimated cost in USD for this generation, when known. */
  costUsd?: number
}

/**
 * A provider that supports media generation (video, and potentially
 * image/audio in the future). The `video` namespace mirrors the Venice
 * video API surface: enqueue, poll for status, quote, and optionally cancel.
 */
export interface MediaProvider {
  video: {
    /** Quote the cost (USD) of a video generation job. */
    quote?(params: VideoQuoteParams): Promise<VideoQuoteResult>
    /** Enqueue a video generation job; returns a queue id. */
    queue(params: VideoQueueParams): Promise<VideoQueueResult>
    /** Retrieve the current status / result of a queued job. */
    retrieve(params: VideoRetrieveParams): Promise<VideoRetrieveResult>
    /** Optionally mark a job complete / cancel it. */
    complete?(params: VideoCompleteParams): Promise<void>
  }
}
