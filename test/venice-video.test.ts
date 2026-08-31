import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VeniceVideoProvider, VeniceVideoError } from '../src/providers/venice.js'
import { VideoRouter } from '../src/router/video.js'
import { VENICE_PREFERRED_VIDEO, createVeniceVideoCandidate } from '../src/providers/venice-catalog.js'
import type { ProviderCandidate } from '../src/router/candidates.js'
import type { MediaProvider, VideoQueueResult, VideoRetrieveResult } from '../src/types.js'

// --- Mock fetch that simulates Venice's async video flow ---
function createMockFetch(opts: { failFirst?: boolean; pollCount?: number } = {}) {
  let queueId = 'test-queue-id-123'
  let pollCount = 0
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    if (opts.failFirst && pollCount === 0 && url.includes('/video/queue')) {
      pollCount++
      throw new Error('Network error (simulated)')
    }

    const body = init?.body ? JSON.parse(init.body as string) : {}

    if (url.includes('/video/queue')) {
      return new Response(JSON.stringify({
        model: body.model,
        queue_id: queueId,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    if (url.includes('/video/retrieve')) {
      pollCount++
      const neededPolls = opts.pollCount ?? 2
      if (pollCount >= neededPolls) {
        // Return COMPLETED with inline binary video
        const videoBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])
        return new Response(videoBytes, {
          status: 200,
          headers: { 'content-type': 'video/mp4' },
        })
      }
      return new Response(JSON.stringify({
        status: 'PROCESSING',
        average_execution_time: 145000,
        execution_duration: 5000,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    if (url.includes('/video/quote')) {
      return new Response(JSON.stringify({ quote: 0.16 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.includes('/video/complete')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    throw new Error(`Unexpected fetch to ${url}`)
  }
  return fetchFn as typeof fetch
}

// --- Tests ---

test('VeniceVideoProvider: queue returns model and queueId', async () => {
  const provider = new VeniceVideoProvider({
    apiKey: 'test-key',
    fetch: createMockFetch(),
  })
  const result = await provider.video.queue({
    model: 'gemini-omni-flash-1-1-text-to-video',
    prompt: 'A gondola at sunset',
    duration: 5,
    resolution: '720p',
  })
  assert.equal(result.model, 'gemini-omni-flash-1-1-text-to-video')
  assert.ok(result.queueId, 'queueId should be present')
})

test('VeniceVideoProvider: retrieve returns PROCESSING then COMPLETED', async () => {
  const provider = new VeniceVideoProvider({
    apiKey: 'test-key',
    fetch: createMockFetch(),
  })

  // First poll: PROCESSING
  const r1 = await provider.video.retrieve({
    model: 'test-model',
    queueId: 'test-queue-id-123',
  })
  assert.equal(r1.status, 'PROCESSING')
  assert.ok(r1.averageExecutionTime !== undefined, 'averageExecutionTime should be present')

  // Second poll: COMPLETED with inline video
  const r2 = await provider.video.retrieve({
    model: 'test-model',
    queueId: 'test-queue-id-123',
  })
  assert.equal(r2.status, 'COMPLETED')
  assert.ok(r2.videoData, 'videoData should be present on COMPLETED')
})

test('VeniceVideoProvider: quote returns USD price', async () => {
  const provider = new VeniceVideoProvider({
    apiKey: 'test-key',
    fetch: createMockFetch(),
  })
  const result = await provider.video.quote!({
    model: 'gemini-omni-flash-1-1-text-to-video',
    duration: 5,
    resolution: '720p',
  })
  assert.equal(result.quote, 0.16)
})

test('VeniceVideoProvider: complete calls the complete endpoint', async () => {
  const provider = new VeniceVideoProvider({
    apiKey: 'test-key',
    fetch: createMockFetch(),
  })
  await provider.video.complete!({
    model: 'test-model',
    queueId: 'test-queue-id-123',
  })
  // Should not throw
  assert.ok(true)
})

test('VeniceVideoProvider: throws on missing apiKey', () => {
  assert.throws(
    () => new VeniceVideoProvider({ apiKey: '' }),
    /requires.*apiKey/i,
  )
})

test('VeniceVideoProvider: VeniceVideoError has status and body', () => {
  const err = new VeniceVideoError('test error', { status: 500, body: 'server error' })
  assert.equal(err.status, 500)
  assert.equal(err.body, 'server error')
  assert.equal(err.name, 'VeniceVideoError')
})

// --- VideoRouter tests ---

test('VideoRouter: generate end-to-end with polling', async () => {
  const fetchFn = createMockFetch()
  const provider = new VeniceVideoProvider({ apiKey: 'test-key', fetch: fetchFn })
  const candidate: ProviderCandidate = {
    id: 'venice-video',
    provider: provider as unknown as ProviderCandidate['provider'],
    models: VENICE_PREFERRED_VIDEO,
  }
  const router = new VideoRouter({
    candidates: [candidate],
    pollIntervalMs: 10,
    maxPollAttempts: 10,
  })
  const result = await router.generate({
    model: 'gemini-omni-flash-1-1-text-to-video',
    prompt: 'A gondola at sunset',
    duration: 5,
    resolution: '720p',
    pollIntervalMs: 10,
    maxPollAttempts: 10,
  })
  assert.ok(result.queueId, 'should have queueId')
  assert.equal(result.model, 'gemini-omni-flash-1-1-text-to-video')
  assert.ok(result.costUsd !== undefined, 'should have costUsd from catalog')
  assert.equal(result.costUsd, 0.16, 'costUsd should be $0.16 for gemini-omni-flash')
})

test('VideoRouter: generate picks cheapest model when no model specified', async () => {
  const fetchFn = createMockFetch()
  const provider = new VeniceVideoProvider({ apiKey: 'test-key', fetch: fetchFn })
  const candidate: ProviderCandidate = {
    id: 'venice-video',
    provider: provider as unknown as ProviderCandidate['provider'],
    models: VENICE_PREFERRED_VIDEO,
  }
  const router = new VideoRouter({
    candidates: [candidate],
    pollIntervalMs: 10,
    maxPollAttempts: 10,
  })
  const result = await router.generate({
    prompt: 'A gondola at sunset',
    duration: 5,
    resolution: '720p',
    pollIntervalMs: 10,
    maxPollAttempts: 10,
  })
  // Should pick the cheapest model (gemini-omni-flash at $0.16)
  assert.equal(result.model, 'gemini-omni-flash-1-1-text-to-video')
  assert.equal(result.costUsd, 0.16)
})

test('VideoRouter: queue returns queueId without polling', async () => {
  const fetchFn = createMockFetch()
  const provider = new VeniceVideoProvider({ apiKey: 'test-key', fetch: fetchFn })
  const candidate: ProviderCandidate = {
    id: 'venice-video',
    provider: provider as unknown as ProviderCandidate['provider'],
    models: VENICE_PREFERRED_VIDEO,
  }
  const router = new VideoRouter({
    candidates: [candidate],
  })
  const result = await router.queue({
    model: 'gemini-omni-flash-1-1-text-to-video',
    prompt: 'test prompt',
    duration: 5,
    resolution: '720p',
  })
  assert.ok(result.queueId, 'should have queueId')
  assert.equal(result.model, 'gemini-omni-flash-1-1-text-to-video')
})

test('VideoRouter: failover to next candidate on error', async () => {
  // First candidate throws a 429 (retryable), second succeeds
  const failingFetch = async () => {
    const err = new Error('429 Too Many Requests') as Error & { status?: number }
    err.status = 429
    throw err
  }
  const failingProvider = new VeniceVideoProvider({
    apiKey: 'test-key',
    fetch: failingFetch as typeof fetch,
  })
  const goodFetch = createMockFetch()
  const goodProvider = new VeniceVideoProvider({ apiKey: 'test-key', fetch: goodFetch })

  const candidates: ProviderCandidate[] = [
    {
      id: 'venice-fail',
      provider: failingProvider as unknown as ProviderCandidate['provider'],
      models: VENICE_PREFERRED_VIDEO,
    },
    {
      id: 'venice-good',
      provider: goodProvider as unknown as ProviderCandidate['provider'],
      models: VENICE_PREFERRED_VIDEO,
    },
  ]

  const router = new VideoRouter({
    candidates,
    pollIntervalMs: 10,
    maxPollAttempts: 10,
  })

  const result = await router.generate({
    model: 'gemini-omni-flash-1-1-text-to-video',
    prompt: 'test',
    duration: 5,
    resolution: '720p',
    pollIntervalMs: 10,
    maxPollAttempts: 10,
  })
  assert.ok(result.queueId, 'should have queueId from the good candidate')
})

test('VideoRouter: emits video_route_selected event', async () => {
  const fetchFn = createMockFetch()
  const provider = new VeniceVideoProvider({ apiKey: 'test-key', fetch: fetchFn })
  const candidate: ProviderCandidate = {
    id: 'venice-video',
    provider: provider as unknown as ProviderCandidate['provider'],
    models: VENICE_PREFERRED_VIDEO,
  }
  const events: string[] = []
  const router = new VideoRouter({
    candidates: [candidate],
    pollIntervalMs: 10,
    maxPollAttempts: 10,
    onEvent: (e) => events.push(e.type),
  })
  await router.generate({
    model: 'gemini-omni-flash-1-1-text-to-video',
    prompt: 'test',
    duration: 5,
    resolution: '720p',
    pollIntervalMs: 10,
    maxPollAttempts: 10,
  })
  assert.ok(events.includes('video_route_selected'), 'should emit video_route_selected')
  assert.ok(events.includes('video_queue_success'), 'should emit video_queue_success')
  assert.ok(events.includes('video_complete'), 'should emit video_complete')
})

test('createVeniceVideoCandidate: returns a valid ProviderCandidate', () => {
  const candidate = createVeniceVideoCandidate({ apiKey: 'test-key' })
  assert.equal(candidate.id, 'venice-video')
  assert.ok(candidate.models, 'should have models')
  assert.equal(candidate.models!.length, VENICE_PREFERRED_VIDEO.length)
  assert.ok(candidate.models!.every(m => m.mediaType === 'video'), 'all models should be video type')
})

import { VENICE_VIDEO_CATALOG } from '../src/providers/venice-catalog.js'

test('VENICE_VIDEO_CATALOG: has 10 models across 3 tiers', () => {
  assert.ok(VENICE_VIDEO_CATALOG.length >= 10, 'should have at least 10 models')
  const tiers = new Set(VENICE_VIDEO_CATALOG.map((m) => m.tier))
  assert.ok(tiers.has('economy'), 'should have economy tier')
  assert.ok(tiers.has('standard'), 'should have standard tier')
  assert.ok(tiers.has('frontier'), 'should have frontier tier')
})
