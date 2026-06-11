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
import { checkBearer } from './auth.js'
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
  if (!config.apiKeys || config.apiKeys.length === 0) {
    console.warn(
      '[shipyard-inference] gateway started with NO api keys — auth is disabled. ' +
        'Set apiKeys for anything but local dev.',
    )
  }

  const router = new Router({
    candidates: config.candidates,
    strategy: config.strategy,
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

  app.use('*', cors({ origin: config.cors?.origins ?? '*' }))

  app.get('/healthz', (c) => c.json({ status: 'ok' }))

  app.get('/v1/models', (c) => {
    if (!checkBearer(config.apiKeys, c.req.header('authorization'))) {
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
    if (!checkBearer(config.apiKeys, c.req.header('authorization'))) {
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

        try {
          await als.run(ctx, async () => {
            for await (const event of router.chatStream(params, { signal: controller.signal })) {
              for (const chunk of encoder.forEvent(event)) {
                await stream.writeSSE({ data: JSON.stringify(chunk) })
              }
            }
          })
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

  return app
}
