import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { Router } from '../router/router.js'
import type { RouterEvent } from '../router/router.js'
import {
  openAIRequestToChatParams,
  llmResponseToOpenAICompletion,
  createChunkEncoder,
  toOpenAIError,
} from '../openai-compat/index.js'
import type { OpenAIChatRequest, OpenAIErrorBody } from '../openai-compat/index.js'
import {
  anthropicRequestToChatParams,
  llmResponseToAnthropicMessage,
  createAnthropicSSEEncoder,
  estimateInputTokens,
  toAnthropicError,
} from '../anthropic-compat/index.js'
import type { AnthropicChatRequest } from '../anthropic-compat/index.js'
import { observeWaitWindow } from '../tender/wait.js'
import type { LLMChatParams, LLMStreamEvent } from '../types.js'
import { resolveAuth } from './auth.js'
import { resolveModelList, type GatewayConfig } from './config.js'

interface RequestContext {
  model?: string
  provider?: string
  costUsd?: number
}

const als = new AsyncLocalStorage<RequestContext>()

function capture(ctx: RequestContext, event: RouterEvent): void {
  if (event.type === 'route_selected') {
    ctx.provider = event.candidateId
    if (event.model) ctx.model = event.model
  } else if (event.type === 'request_completed') {
    ctx.provider = event.candidateId
    if (event.model) ctx.model = event.model
    ctx.costUsd = event.actualCostUsd
  }
}

function requestId(): string {
  return `chatcmpl-${randomBytes(12).toString('hex')}`
}

function errorJson(
  c: Context,
  status: number,
  message: string,
  type: string,
): Response {
  const body: OpenAIErrorBody = { error: { message, type, code: null, param: null } }
  return c.json(body, status as 400)
}

/**
 * Build the OpenAI-compatible gateway as a Hono app. Pure and port-free, so it
 * can be exercised in-process via `app.request(...)`. The Router is constructed
 * here so per-request telemetry (chosen model/provider/cost) can be captured
 * via AsyncLocalStorage and surfaced as `x-shipyard-*` headers / an SSE trailer.
 */
export function createGatewayApp(config: GatewayConfig): Hono {
  if ((!config.apiKeys || config.apiKeys.length === 0) && !config.keyStore) {
    console.warn(
      '[shipyard-inference] gateway started with NO api keys and no key store — ' +
        'auth is disabled. Set apiKeys or a keyStore for anything but local dev.',
    )
  }

  const router = new Router({
    candidates: config.candidates,
    strategy: config.strategy,
    baselineModel: config.baselineModel,
    pricingOverrides: config.pricingOverrides,
    cache: config.cache,
    usageRecorder: config.usageRecorder,
    onEvent: (event) => {
      const ctx = als.getStore()
      if (ctx) capture(ctx, event)
      // Fire-and-forget: the reporter's bounded queue never throws or blocks.
      config.telemetry?.onEvent(event)
      config.onEvent?.(event)
    },
  })

  const exposeCost = config.exposeCostHeaders !== false
  const app = new Hono()

  // Tender — monetize the wait state of a streaming request. Wraps the model
  // stream: on a qualifying wait it auctions a placement (the account's current
  // ad, shown in their status line); on completion it attests the real, billed
  // impression and accrues the kickback. A no-op without `config.tender` or an
  // attributed account. The content stream passes through untouched.
  function wrapTender(
    account: string | undefined,
    reqId: string,
    params: LLMChatParams,
    surfaceId: string,
    source: AsyncIterable<LLMStreamEvent>,
  ): { stream: AsyncIterable<LLMStreamEvent>; finish: (ctx: RequestContext) => void } {
    const tender = config.tender
    if (!tender || !account) return { stream: source, finish: () => {} }
    let placement: { placementId: string; usdcPerImpression: number } | null = null
    let waitMs: number | undefined
    const observed = observeWaitWindow(
      source,
      {
        onWaitWindow: () => {
          placement = tender.serve({
            requestId: reqId,
            surfaceId,
            userId: account,
            userWallet: account,
            agentic: (params.tools?.length ?? 0) > 0,
          })
        },
        onFirstToken: (ms) => {
          waitMs = ms
        },
      },
      { minWaitMs: tender.minWaitMs },
    )
    const finish = (ctx: RequestContext): void => {
      if (!placement) return
      tender.settle({
        userId: account,
        requestId: reqId,
        model: ctx.model ?? params.model ?? 'unknown',
        billedCostUsd: ctx.costUsd ?? 0,
        measuredWaitMs: waitMs ?? 0,
        placement,
        surfaceId,
      })
    }
    return { stream: observed, finish }
  }

  app.use('*', cors({ origin: config.cors?.origins ?? '*' }))

  app.get('/healthz', (c) => c.json({ status: 'ok' }))

  app.get('/v1/models', async (c) => {
    if (!(await resolveAuth(config, c.req.header('authorization'))).ok) {
      return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    }
    return c.json({
      object: 'list',
      data: resolveModelList(config).map((m) => ({
        id: m.id,
        object: 'model',
        created: 0,
        owned_by: m.ownedBy ?? 'shipyard',
      })),
    })
  })

  app.post('/v1/chat/completions', async (c) => {
    const auth = await resolveAuth(config, c.req.header('authorization'))
    if (!auth.ok) {
      return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    }

    let body: OpenAIChatRequest
    try {
      body = (await c.req.json()) as OpenAIChatRequest
    } catch {
      return errorJson(c, 400, 'Invalid JSON body', 'invalid_request_error')
    }
    if (!body || !Array.isArray(body.messages)) {
      return errorJson(c, 400, '`messages` is required', 'invalid_request_error')
    }

    const params = openAIRequestToChatParams(body)
    // A per-user key attributes the request to its account — so the developer's
    // IDE traffic ties to their wallet, no `user` field needed. Overrides `user`.
    if (auth.account?.userId) {
      params.metadata = { ...(params.metadata ?? {}), userId: auth.account.userId }
    }
    const id = requestId()
    const ctx: RequestContext = {}

    if (body.stream) {
      return streamSSE(c, async (stream) => {
        const encoder = createChunkEncoder(
          body.model,
          id,
          body.stream_options?.include_usage ?? false,
        )
        const controller = new AbortController()
        stream.onAbort(() => controller.abort())

        const { stream: tstream, finish } = wrapTender(
          auth.account?.userId,
          id,
          params,
          'gateway-openai',
          router.chatStream(params, { signal: controller.signal }),
        )
        try {
          await als.run(ctx, async () => {
            for await (const event of tstream) {
              for (const chunk of encoder.forEvent(event)) {
                await stream.writeSSE({ data: JSON.stringify(chunk) })
              }
            }
          })
          finish(ctx)
          if (exposeCost && (ctx.model || ctx.costUsd !== undefined)) {
            await stream.writeSSE({
              data: JSON.stringify({
                x_shipyard: { model: ctx.model, provider: ctx.provider, costUsd: ctx.costUsd },
              }),
            })
          }
          await stream.writeSSE({ data: '[DONE]' })
        } catch (err) {
          await stream.writeSSE({ data: JSON.stringify(toOpenAIError(err).body) })
          await stream.writeSSE({ data: '[DONE]' })
        }
      })
    }

    try {
      const res = await als.run(ctx, () => router.chat(params))
      if (exposeCost) {
        if (ctx.model) c.header('x-shipyard-model', ctx.model)
        if (ctx.provider) c.header('x-shipyard-provider', ctx.provider)
        if (ctx.costUsd !== undefined) c.header('x-shipyard-cost-usd', String(ctx.costUsd))
      }
      return c.json(llmResponseToOpenAICompletion(res, body.model, id))
    } catch (err) {
      const { status, body: errBody } = toOpenAIError(err)
      return c.json(errBody, status as 400)
    }
  })

  // ── Anthropic Messages API — for Claude Code / Anthropic-SDK agents ────────
  // Point Claude Code here with ANTHROPIC_BASE_URL=<gateway> (NO /v1 — it
  // appends /v1/messages). Auth via x-api-key (ANTHROPIC_API_KEY) or Bearer
  // (ANTHROPIC_AUTH_TOKEN); both resolve a per-user key, same as the OpenAI side.
  const anthropicAuth = (c: Context): string | undefined => {
    const bearer = c.req.header('authorization')
    if (bearer) return bearer
    const key = c.req.header('x-api-key')
    return key ? `Bearer ${key}` : undefined
  }
  const anthropicAuthError = { type: 'error' as const, error: { type: 'authentication_error', message: 'Invalid API key' } }
  const anthropicBadJson = { type: 'error' as const, error: { type: 'invalid_request_error', message: 'Invalid JSON body' } }

  app.post('/v1/messages/count_tokens', async (c) => {
    if (!(await resolveAuth(config, anthropicAuth(c))).ok) return c.json(anthropicAuthError, 401)
    let body: AnthropicChatRequest
    try {
      body = (await c.req.json()) as AnthropicChatRequest
    } catch {
      return c.json(anthropicBadJson, 400)
    }
    return c.json({ input_tokens: estimateInputTokens(body) })
  })

  app.post('/v1/messages', async (c) => {
    const auth = await resolveAuth(config, anthropicAuth(c))
    if (!auth.ok) return c.json(anthropicAuthError, 401)

    let body: AnthropicChatRequest
    try {
      body = (await c.req.json()) as AnthropicChatRequest
    } catch {
      return c.json(anthropicBadJson, 400)
    }
    if (!body || !Array.isArray(body.messages)) {
      return c.json({ type: 'error' as const, error: { type: 'invalid_request_error', message: '`messages` is required' } }, 400)
    }

    const params = anthropicRequestToChatParams(body)
    if (auth.account?.userId) params.metadata = { ...(params.metadata ?? {}), userId: auth.account.userId }
    const id = `msg_${randomBytes(12).toString('hex')}`
    const ctx: RequestContext = {}

    if (body.stream) {
      return streamSSE(c, async (stream) => {
        const encoder = createAnthropicSSEEncoder(body.model, id)
        const controller = new AbortController()
        stream.onAbort(() => controller.abort())
        const { stream: tstream, finish } = wrapTender(
          auth.account?.userId,
          id,
          params,
          'gateway-anthropic',
          router.chatStream(params, { signal: controller.signal }),
        )
        try {
          await als.run(ctx, async () => {
            for await (const event of tstream) {
              for (const f of encoder.forEvent(event)) {
                await stream.writeSSE({ event: f.event, data: f.data })
              }
            }
          })
          finish(ctx)
        } catch (err) {
          await stream.writeSSE({ event: 'error', data: JSON.stringify(toAnthropicError(err).body) })
        }
      })
    }

    try {
      const res = await als.run(ctx, () => router.chat(params))
      if (exposeCost) {
        if (ctx.model) c.header('x-shipyard-model', ctx.model)
        if (ctx.provider) c.header('x-shipyard-provider', ctx.provider)
        if (ctx.costUsd !== undefined) c.header('x-shipyard-cost-usd', String(ctx.costUsd))
      }
      return c.json(llmResponseToAnthropicMessage(res, body.model, id))
    } catch (err) {
      const { status, body: errBody } = toAnthropicError(err)
      return c.json(errBody, status as 400)
    }
  })

  return app
}
