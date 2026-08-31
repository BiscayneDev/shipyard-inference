import type {
  VideoQueueParams,
  VideoQueueResult,
  VideoRetrieveParams,
  VideoRetrieveResult,
  VideoCompleteParams,
  VideoGenerateParams,
  VideoGenerateResult,
  MediaProvider,
  VideoStatus,
} from '../types.js'
import type { ModelMetadata, ProviderCandidate } from './candidates.js'
import { NoCapableModelError, isRetryable } from './errors.js'
import { resolveModelMetadata } from './pricing.js'
import { sleep } from './retry.js'

/**
 * Events emitted by {@link VideoRouter} for observability. Mirrors the shape of
 * `RouterEvent` but scoped to the video lifecycle (queue → poll → complete).
 */
export type VideoRouterEvent =
  | {
      type: 'video_route_selected'
      candidateId: string
      model: string
      estimatedCostUsd?: number
      attempt: number
    }
  | {
      type: 'video_queue_success'
      candidateId: string
      model: string
      queueId: string
      attempt: number
    }
  | {
      type: 'video_polling'
      candidateId: string
      model: string
      queueId: string
      status: VideoStatus
      pollAttempt: number
    }
  | {
      type: 'video_complete'
      candidateId: string
      model: string
      queueId: string
      attempt: number
    }
  | {
      type: 'video_failover'
      candidateId: string
      model: string
      attempt: number
      error: unknown
    }
  | {
      type: 'video_error'
      candidateId: string
      model: string
      attempt: number
      error: unknown
    }

export interface VideoRouterOptions {
  /** Candidates to consider; only those with video-capable models are used. */
  candidates: ProviderCandidate[]
  /**
   * Pricing/capability overrides merged below per-candidate metadata, same as
   * `RouterOptions.pricingOverrides`.
   */
  pricingOverrides?: Record<string, Partial<ModelMetadata>>
  /** Observability hook for video routing/failover/polling events. */
  onEvent?: (event: VideoRouterEvent) => void
  /** Milliseconds between retrieve polls. Default 5000. */
  pollIntervalMs?: number
  /** Max poll attempts before giving up. Default 60. */
  maxPollAttempts?: number
  /** Max number of candidates to try on failover. Defaults to "try them all". */
  maxFailoverAttempts?: number
}

/**
 * A video-capable candidate with its resolved model metadata, sorted cheapest
 * first by `costPerGeneration`.
 */
interface VideoCandidate {
  candidate: ProviderCandidate
  model: string
  meta: ModelMetadata
  costPerGeneration?: number
}

/**
 * Async video generation with routing, failover, and telemetry. Filters the
 * candidate list for models with `mediaType === 'video'`, routes to the
 * cheapest, queues, polls until `COMPLETED`, and emits lifecycle events.
 */
export class VideoRouter {
  private readonly opts: VideoRouterOptions
  private readonly videoCandidates: VideoCandidate[]

  constructor(opts: VideoRouterOptions) {
    this.opts = opts
    this.videoCandidates = this.selectVideoCandidates(opts.candidates, opts.pricingOverrides)
  }

  /**
   * Convenience: pick the cheapest video model (or use `params.model`), queue,
   * poll until `COMPLETED`, and return the final result with `costUsd`.
   */
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const candidates = this.resolveCandidates(params.model)

    if (candidates.length === 0) {
      throw new NoCapableModelError(
        '[shipyard-inference] No video-capable candidate found',
      )
    }

    const limit = Math.min(candidates.length, this.opts.maxFailoverAttempts ?? candidates.length)
    let lastError: unknown

    for (let attempt = 0; attempt < limit; attempt++) {
      const { candidate, model, meta } = candidates[attempt]!
      this.emit({
        type: 'video_route_selected',
        candidateId: candidate.id,
        model,
        estimatedCostUsd: meta.costPerGeneration,
        attempt,
      })

      try {
        const queueRes = await this.queueFromCandidate(candidate, model, params)
        const retrieveRes = await this.pollFromCandidate(
          candidate,
          model,
          queueRes.queueId,
          params,
        )

        this.emit({
          type: 'video_complete',
          candidateId: candidate.id,
          model,
          queueId: queueRes.queueId,
          attempt,
        })

        return {
          model,
          queueId: queueRes.queueId,
          videoData: retrieveRes.videoData,
          downloadUrl: retrieveRes.downloadUrl ?? queueRes.downloadUrl,
          costUsd: meta.costPerGeneration,
        }
      } catch (error) {
        lastError = error
        const hasMore = attempt < limit - 1
        if (hasMore && isRetryable(error)) {
          this.emit({
            type: 'video_failover',
            candidateId: candidate.id,
            model,
            attempt,
            error,
          })
          continue
        }
        this.emit({
          type: 'video_error',
          candidateId: candidate.id,
          model,
          attempt,
          error,
        })
        throw error
      }
    }

    throw lastError
  }

  /** Queue a video generation job; returns the queue id. */
  async queue(params: VideoQueueParams): Promise<VideoQueueResult> {
    const candidates = this.resolveCandidates(params.model)

    if (candidates.length === 0) {
      throw new NoCapableModelError(
        '[shipyard-inference] No video-capable candidate found',
      )
    }

    const limit = Math.min(candidates.length, this.opts.maxFailoverAttempts ?? candidates.length)
    let lastError: unknown

    for (let attempt = 0; attempt < limit; attempt++) {
      const { candidate, model } = candidates[attempt]!
      this.emit({
        type: 'video_route_selected',
        candidateId: candidate.id,
        model,
        estimatedCostUsd: candidates[attempt]!.meta.costPerGeneration,
        attempt,
      })
      try {
        return await this.queueFromCandidate(candidate, model, params)
      } catch (error) {
        lastError = error
        const hasMore = attempt < limit - 1
        if (hasMore && isRetryable(error)) {
          this.emit({
            type: 'video_failover',
            candidateId: candidate.id,
            model,
            attempt,
            error,
          })
          continue
        }
        this.emit({
          type: 'video_error',
          candidateId: candidate.id,
          model,
          attempt,
          error,
        })
        throw error
      }
    }

    throw lastError
  }

  /** Retrieve the status/result of a queued job; delegates to the first video-capable candidate. */
  async retrieve(params: VideoRetrieveParams): Promise<VideoRetrieveResult> {
    const candidates = this.resolveCandidates(params.model)
    if (candidates.length === 0) {
      throw new NoCapableModelError(
        '[shipyard-inference] No video-capable candidate found',
      )
    }
    const { candidate, model } = candidates[0]!
    const provider = candidate.provider as unknown as MediaProvider
    return provider.video.retrieve({
      model,
      queueId: params.queueId,
      downloadUrl: params.downloadUrl,
    })
  }

  /** Mark a job complete / cancel it; delegates to the first video-capable candidate. */
  async complete(params: VideoCompleteParams): Promise<void> {
    const candidates = this.resolveCandidates(params.model)
    if (candidates.length === 0) {
      throw new NoCapableModelError(
        '[shipyard-inference] No video-capable candidate found',
      )
    }
    const { candidate, model } = candidates[0]!
    const provider = candidate.provider as unknown as MediaProvider
    if (!provider.video.complete) return
    await provider.video.complete({ model, queueId: params.queueId })
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /** Filter + sort candidates for video-capable models, cheapest generation cost first. */
  private selectVideoCandidates(
    candidates: ProviderCandidate[],
    overrides?: Record<string, Partial<ModelMetadata>>,
  ): VideoCandidate[] {
    const out: VideoCandidate[] = []
    for (const candidate of candidates) {
      for (const m of candidate.models ?? []) {
        const { meta } = resolveModelMetadata(m.model, m, overrides)
        if (meta.mediaType !== 'video') continue
        out.push({
          candidate,
          model: meta.model,
          meta,
          costPerGeneration: meta.costPerGeneration,
        })
      }
    }
    out.sort(
      (a, b) => (a.costPerGeneration ?? Infinity) - (b.costPerGeneration ?? Infinity),
    )
    return out
  }

  /**
   * Resolve the ordered candidate list for a request. If `paramsModel` is
   * specified, filter to candidates matching that model; otherwise return all
   * video candidates (cheapest first).
   */
  private resolveCandidates(paramsModel?: string): VideoCandidate[] {
    if (!paramsModel) return this.videoCandidates
    return this.videoCandidates.filter((c) => c.model === paramsModel)
  }

  /** Queue a job on a specific candidate, emitting the success event. */
  private async queueFromCandidate(
    candidate: ProviderCandidate,
    model: string,
    params: VideoQueueParams,
  ): Promise<VideoQueueResult> {
    const provider = candidate.provider as unknown as MediaProvider
    const res = await provider.video.queue({ ...params, model })
    this.emit({
      type: 'video_queue_success',
      candidateId: candidate.id,
      model,
      queueId: res.queueId,
      attempt: 0,
    })
    return res
  }

  /** Poll retrieve until `COMPLETED` or the poll budget is exhausted. */
  private async pollFromCandidate(
    candidate: ProviderCandidate,
    model: string,
    queueId: string,
    params: VideoGenerateParams,
  ): Promise<VideoRetrieveResult> {
    const provider = candidate.provider as unknown as MediaProvider
    const interval = params.pollIntervalMs ?? this.opts.pollIntervalMs ?? 5_000
    const maxAttempts = params.maxPollAttempts ?? this.opts.maxPollAttempts ?? 60

    let retrieveParams: VideoRetrieveParams = { model, queueId }

    for (let pollAttempt = 0; pollAttempt < maxAttempts; pollAttempt++) {
      if (pollAttempt > 0) await sleep(interval)

      const res = await provider.video.retrieve(retrieveParams)

      this.emit({
        type: 'video_polling',
        candidateId: candidate.id,
        model,
        queueId,
        status: res.status,
        pollAttempt,
      })

      if (res.status === 'COMPLETED') {
        // Carry forward downloadUrl for subsequent retrieves if needed.
        if (res.downloadUrl) {
          retrieveParams = { ...retrieveParams, downloadUrl: res.downloadUrl }
        }
        return res
      }

      // Update downloadUrl for next poll if provider returns one early.
      if (res.downloadUrl) {
        retrieveParams = { ...retrieveParams, downloadUrl: res.downloadUrl }
      }
    }

    throw new Error(
      `[shipyard-inference] Video generation ${queueId} did not complete within ${maxAttempts} polls`,
    )
  }

  private emit(event: VideoRouterEvent): void {
    this.opts.onEvent?.(event)
  }
}
