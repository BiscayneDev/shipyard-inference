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
import { TENDER_DEFAULTS } from '../tender/types.js'
import type { LLMChatParams, LLMStreamEvent, VideoQueueParams, VideoRetrieveParams, VideoCompleteParams, VideoGenerateParams } from '../types.js'
import { resolveAuth, bearerToken } from './auth.js'
import type { AuthResult } from './auth.js'
import { resolveModelList, type GatewayConfig, type GuardrailResult } from './config.js'
import type { DecisionQuestion } from '../decisions/types.js'
import { buildChallenge, verifyX402Payment } from './x402.js'
import {
  buildUptoChallenge,
  verifyUptoOpen,
  settleUpto,
  ceilingAtomic,
  perTokenAtomic,
} from './x402-upto.js'
import type { UptoVerified, UptoSettlement } from './x402-upto.js'
import { isCapable } from '../router/capabilities.js'
import type { RoutingHints } from '../types.js'

/** The request's x402 payment credential: `PAYMENT-SIGNATURE` (x402 v2) or
 *  `X-PAYMENT` (v1, the `exact` scheme's createPayingFetch). */
function paymentHeaderOf(c: Context): string | undefined {
  return c.req.header('payment-signature') ?? c.req.header('x-payment')
}

/**
 * Honor an explicitly requested model: when the request names a model the
 * deployment declares — and that model is actually capable of the request —
 * pin routing to the candidate that owns it, so the caller gets exactly that
 * model. `auto` (or an unknown id) falls through to strategy routing
 * (cost-optimized, optionally with an auto-tier floor), and an explicit model
 * that can't serve the request (e.g. tools against a non-tools model) also
 * falls through, preserving the no-capable-model 400 contract.
 */
function explicitModelHints(
  config: GatewayConfig,
  model: string | undefined,
  params: LLMChatParams,
): RoutingHints | undefined {
  if (!model) return undefined
  const requested = model.trim().toLowerCase()
  if (!requested || requested === 'auto' || requested === 'shipyard-auto') return undefined
  for (const candidate of config.candidates) {
    for (const declared of candidate.models ?? []) {
      if (declared.model.toLowerCase() === requested) {
        return isCapable(declared, undefined, params)
          ? { pin: { provider: candidate.id, model: declared.model } }
          : undefined
      }
    }
  }
  return undefined
}

/** Auth outcome extended with a pending `upto` settlement (metered billing). */
interface AuthOutcome extends AuthResult {
  /** Present when a keyless request paid via x402 `upto` — the caller settles
   *  it after serving, from metered usage. */
  upto?: UptoVerified
}

/**
 * Resolve auth for an inference route, allowing a verified x402 payment to
 * substitute for an API key. Returns a successful AuthResult, a failed
 * AuthResult (caller 401s), or a 402 Response when payment is required.
 *
 * `scheme: 'upto'` (metered): the 402 advertises a ceiling and a fresh
 * blockhash so the client can open a payment channel; a presented `X-PAYMENT`
 * is verified + escrowed here (before serving) and returned as `upto` for the
 * route to settle from metered tokens after the model runs.
 */
async function authOrPayment(
  config: GatewayConfig,
  authHeader: string | undefined,
  paymentHeader: string | undefined,
  resource: string,
  requestUrl?: string,
): Promise<AuthOutcome | Response> {
  const auth = await resolveAuth(config, authHeader)
  if (auth.ok) return auth
  if (!config.x402) return auth
  const x402 = config.x402

  if (x402.scheme === 'upto') {
    const ceiling = ceilingAtomic(x402.priceUsdc)
    const url = requestUrl ?? resource
    const challenge = () =>
      buildUptoChallenge(x402, url, ceiling).then((ch) =>
        Response.json(ch.body, {
          status: 402,
          headers: { 'payment-required': ch.paymentRequiredHeader, 'x-402-challenge': 'solana-usdc-upto' },
        }),
      )
    if (!paymentHeader) return await challenge()
    try {
      const verified = await verifyUptoOpen(x402, paymentHeader, ceiling)
      return {
        ok: true,
        account: {
          userId: verified.payer || 'x402-payer',
          wallet: verified.payer,
          label: 'x402-upto',
          status: 'active',
          createdAt: Date.now(),
        },
        upto: verified,
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : JSON.stringify(String(err))
      const ch = await buildUptoChallenge(x402, url, ceiling)
      return Response.json({ ...ch.body, error: message }, {
        status: 402,
        headers: { 'payment-required': ch.paymentRequiredHeader, 'x-402-error': message },
      })
    }
  }

  if (!paymentHeader) {
    return Response.json(buildChallenge(config.x402, resource), {
      status: 402,
      headers: { 'x-402-challenge': 'solana-usdc' },
    })
  }
  const result = await verifyX402Payment(config.x402, paymentHeader)
  if (!result.ok) {
    const challenge = buildChallenge(config.x402, resource)
    return Response.json({ ...challenge, error: result.error }, {
      status: 402,
      headers: { 'x-402-error': String(result.error) },
    })
  }
  config.onX402Payment?.({
    payer: result.payer,
    signature: result.signature!,
    amountUsdc: result.amountUsdc ?? 0,
  })
  return {
    ok: true,
    account: {
      userId: result.payer ?? 'x402-payer',
      wallet: result.payer,
      label: 'x402',
      status: 'active',
      createdAt: Date.now(),
    },
  }
}

/**
 * Settle a metered `upto` request after serving: tokens × per-token price,
 * clamped to the ceiling, refunded remainder. Best-effort — a settle failure
 * after a served response is logged (the escrowed channel refunds the payer
 * via its withdraw path on close); never blocks the response.
 */
async function settleUptoSafe(
  config: GatewayConfig,
  verified: UptoVerified,
  baseUnits: bigint,
): Promise<UptoSettlement | undefined> {
  try {
    const settlement = await settleUpto(config.x402!, verified, baseUnits)
    config.onX402Payment?.({
      payer: verified.payer,
      signature: settlement.transaction,
      amountUsdc: Number(settlement.amountBaseUnits) / 1e6,
    })
    return settlement
  } catch (err) {
    console.warn(
      `[shipyard-gateway] upto settle failed (channel refunds via withdraw): ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return undefined
  }
}

/** Metered charge for a completed request: tokens when the upstream reports
 *  usage, else a chars/4 estimate. Minimum one token. */
function uptoCharge(x402: NonNullable<GatewayConfig['x402']>, tokens: number | undefined, contentChars: number): bigint {
  const t = tokens ?? Math.max(1, Math.ceil(contentChars / 4))
  return BigInt(Math.max(1, t)) * perTokenAtomic(x402.perTokenUsdc ?? 0)
}

interface RequestContext {
  /** Request id, used to join tier decisions with guardrail outcomes. */
  id?: string
  model?: string
  provider?: string
  costUsd?: number
  /** Failover receipt for this request, set when a provider failed over. */
  failover?: { from: string; to?: string; reason: string }
  routing?: {
    tier: string
    source: 'jev' | 'structural'
    jevTier?: string
    structuralTier?: string
    confidence?: number
    needsReasoning?: number
    latencyMs?: number
    decidedBy?: string
    usage?: { inputTokens: number; outputTokens: number }
  }
}

const als = new AsyncLocalStorage<RequestContext>()

function capture(ctx: RequestContext, event: RouterEvent): void {
  if (event.type === 'route_selected') {
    ctx.provider = event.candidateId
    if (event.model) ctx.model = event.model
    // A route_selected after a failover event is the rung we landed on.
    if (ctx.failover && !ctx.failover.to) ctx.failover.to = event.candidateId
  } else if (event.type === 'request_completed') {
    ctx.provider = event.candidateId
    if (event.model) ctx.model = event.model
    ctx.costUsd = event.actualCostUsd
  } else if (event.type === 'failover') {
    // Record the receipt; the `to` rung is filled in by the next
    // route_selected (the candidate the failover loop lands on).
    if (!ctx.failover) {
      ctx.failover = { from: event.candidateId, reason: classifyFailoverReason(event.error) }
    }
  } else if (event.type === 'tier_decided') {
    ctx.routing = {
      tier: event.tier,
      source: event.source,
      ...(event.jevTier !== undefined ? { jevTier: event.jevTier } : {}),
      ...(event.structuralTier !== undefined ? { structuralTier: event.structuralTier } : {}),
      ...(event.confidence !== undefined ? { confidence: event.confidence } : {}),
      ...(event.needsReasoning !== undefined ? { needsReasoning: event.needsReasoning } : {}),
      ...(event.latencyMs !== undefined ? { latencyMs: event.latencyMs } : {}),
      ...(event.decidedBy !== undefined ? { decidedBy: event.decidedBy } : {}),
      ...(event.usage ? { usage: event.usage } : {}),
    }
  }
}

/**
 * Human-stable reason code for a failover receipt: rate_limited (429/429-like),
 * provider_error (5xx / unknown retryable), context_overflow (window fit).
 */
function classifyFailoverReason(error: unknown): string {
  const e = error as { status?: number; message?: string } | null
  if (e && typeof e === 'object') {
    if (e.status === 429 || /rate.?limit|429/i.test(e.message ?? '')) return 'rate_limited'
    if (e.status === 400 && /context|token limit|too long/i.test(e.message ?? '')) {
      return 'context_overflow'
    }
    if (e.status !== undefined && e.status >= 500) return 'provider_error'
  }
  return 'provider_error'
}

function requestId(): string {
  return `chatcmpl-${randomBytes(12).toString('hex')}`
}

/**
 * Observe-only guardrail evaluation of a completed completion: one bundled
 * decision call (safety + quality), fire-and-forget so the response path is
 * untouched. Failures are swallowed — guardrails never take a request down.
 */
function evaluateGuardrails(
  config: GatewayConfig,
  reqId: string,
  params: LLMChatParams,
  output: string,
  model?: string,
): void {
  const g = config.guardrails
  if (!g) return
  const flagUnsafeAbove = g.flagUnsafeAbove ?? 0.8
  const flagQualityBelow = g.flagQualityBelow ?? 0.25
  void g.provider
    .decide({
      state: {
        request: {
          system: params.system,
          messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
          tools: params.tools.map((t) => t.name),
        },
        output,
      },
      questions: {
        unsafe: {
          type: 'noul',
          instructions:
            "The output is unsafe, harmful, or ignores the developer's instructions.",
        },
        quality: {
          type: 'score',
          instructions: 'How well the output answers the request',
          criteria: [
            'Does not address the request, or is wrong',
            'Partially addresses the request',
            'Fully and correctly addresses the request',
          ],
        },
      },
      model: g.model,
    })
    .then((res) => {
      const unsafeAnswer = res.answers['unsafe']
      const qualityAnswer = res.answers['quality']
      const unsafe = unsafeAnswer?.type === 'noul' ? unsafeAnswer.noul : undefined
      // 3-level score ladder → 0–1
      const quality =
        qualityAnswer?.type === 'score' && qualityAnswer.probabilities
          ? qualityAnswer.score / 2
          : undefined
      const flagged =
        (unsafe !== undefined && unsafe > flagUnsafeAbove) ||
        (quality !== undefined && quality < flagQualityBelow)
      const result: GuardrailResult = {
        requestId: reqId,
        model,
        unsafe,
        quality,
        flagged,
        judgedBy: res.model,
      }
      const recorded = Promise.resolve(
        config.decisionFeedback?.recordGuardrail(result),
      ).catch(() => {})
      keepAlive(recorded)
      g.onResult?.(result)
    })
    .catch(() => {
      // observe-only: a down guardrail backend is silent by design
    })
}

/**
 * Keep a fire-and-forget promise alive across the invocation freeze on
 * serverless (no-op locally): persisted feedback writes must outlive the
 * response being sent. Mirrors the chat-portal's saveScope pattern.
 */
function keepAlive(p: Promise<unknown>): void {
  import('@vercel/functions')
    .then(({ waitUntil }) => waitUntil(p))
    .catch(() => {
      // Not on Vercel (local dev) — the event loop keeps the write alive.
    })
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
  if ((!config.apiKeys || config.apiKeys.length === 0) && !config.keyStore && !config.bootstrapAuth) {
    console.warn(
      '[shipyard-inference] gateway started with NO api keys and no key store — ' +
        'auth is disabled. Set apiKeys or a keyStore for anything but local dev.',
    )
  } else if (config.bootstrapAuth && (!config.apiKeys || config.apiKeys.length === 0)) {
    console.warn('[shipyard-inference] gateway running in bootstrap auth mode (local dev).')
  }

  const router = new Router({
    candidates: config.candidates,
    strategy: config.strategy,
    baselineModel: config.baselineModel,
    pricingOverrides: config.pricingOverrides,
    autoTier: config.autoTier,
    cache: config.cache,
    usageRecorder: config.usageRecorder,
    health: config.health,
    onEvent: (event) => {
      const ctx = als.getStore()
      if (ctx) capture(ctx, event)
      if (event.type === 'tier_decided' && ctx?.id && config.decisionFeedback) {
        keepAlive(
          Promise.resolve(
            config.decisionFeedback.recordTier(ctx.id, {
              tier: event.tier,
              source: event.source,
              ...(event.jevTier !== undefined ? { jevTier: event.jevTier } : {}),
              ...(event.structuralTier !== undefined ? { structuralTier: event.structuralTier } : {}),
              ...(event.confidence !== undefined ? { confidence: event.confidence } : {}),
              ...(event.needsReasoning !== undefined ? { needsReasoning: event.needsReasoning } : {}),
              ...(event.latencyMs !== undefined ? { latencyMs: event.latencyMs } : {}),
              ...(event.decidedBy !== undefined ? { decidedBy: event.decidedBy } : {}),
              ...(event.usage ? { usage: event.usage } : {}),
              ...(event.cached !== undefined ? { cached: event.cached } : {}),
            }),
          ).catch(() => {}),
        )
      }
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
  //
  // The wait we monetize is the WHOLE turn the developer waits for — the full
  // generation streams over that time (and, in agentic runs, the tool round-trips
  // between steps). We gate on total turn duration, NOT time-to-first-token: the
  // gateway routes fast (TTFT is typically sub-perceptual ~200ms), so a
  // first-token-idle gate would essentially never fire for real agent traffic. A
  // placement is auctioned once the turn has run past `minWaitMs` (so it can be
  // shown DURING the wait, not after), and at completion we attest the real total
  // wait — the `measuredWaitMs >= minWaitMs` gate keeps it honest: a turn that
  // finishes sub-threshold serves nothing and bills nothing.
  function wrapTender(
    account: string | undefined,
    reqId: string,
    params: LLMChatParams,
    surfaceId: string,
    source: AsyncIterable<LLMStreamEvent>,
  ): { stream: AsyncIterable<LLMStreamEvent>; finish: (ctx: RequestContext) => Promise<void> } {
    const tender = config.tender
    if (!tender || !account) return { stream: source, finish: async () => {} }
    const minWaitMs = tender.minWaitMs ?? TENDER_DEFAULTS.MIN_WAIT_MS
    let placement: { placementId: string; usdcPerImpression: number; line: string } | null = null
    const startedAt = Date.now()
    // Open a placement once the developer has been waiting `minWaitMs` for this
    // turn to stream. The timer only ever signals serve() — it never receives the
    // content stream, so an ad can't be spliced into the response (the placement
    // invariant holds by construction).
    const timer = setTimeout(() => {
      placement = tender.serve({
        requestId: reqId,
        surfaceId,
        userId: account,
        userWallet: account,
        agentic: (params.tools?.length ?? 0) > 0,
      })
    }, minWaitMs)
    // Pass-through: yield every event unchanged, just observe when the turn ends.
    async function* observed(): AsyncIterable<LLMStreamEvent> {
      try {
        for await (const event of source) yield event
      } finally {
        clearTimeout(timer)
      }
    }
    const finish = async (ctx: RequestContext): Promise<void> => {
      clearTimeout(timer)
      if (!placement) return
      await tender.settle({
        userId: account,
        requestId: reqId,
        model: ctx.model ?? params.model ?? 'unknown',
        billedCostUsd: ctx.costUsd ?? 0,
        measuredWaitMs: Date.now() - startedAt,
        placement,
        surfaceId,
      })
    }
    return { stream: observed(), finish }
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
    const auth = await authOrPayment(
      config,
      c.req.header('authorization'),
      paymentHeaderOf(c),
      '/v1/chat/completions',
      c.req.url,
    )
    if (auth instanceof Response) return auth
    if (!auth.ok) {
      return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    }
    const upto = auth.upto

    // Spend circuit breaker (keyed requests only): block before serving with a
    // recoverable 402 — never a dead session. Keyless x402 requests skip this;
    // their wallet balance is their own limit.
    const spendKey = auth.account?.userId ?? bearerToken(c.req.header('authorization'))
    if (config.spend && spendKey) {
      // Estimate from the requested model's declared pricing when available;
      // an unknown/unpriced request is checked at zero cost (free traffic
      // always passes — the breaker guards paid bursts).
      const estimate = 0
      // Project-level aggregate cap first: once aggregate recorded spend
      // crosses the ceiling within the window, ANY keyed request is rejected
      // until the window resets — even a zero-cost one (a drained project
      // stays drained; a project cap is an operator budget).
      const projectCap = config.spend.project
      const projectId = projectCap?.id ?? 'default'
      if (
        projectCap &&
        config.spend.tracker.checkProject?.(projectId, projectCap, estimate) === 'block'
      ) {
        return c.json(
          {
            error: {
              message:
                'Project spend ceiling exceeded. Top up to continue — blocked until the window resets.',
              type: 'spend_ceiling_exceeded',
              code: null,
              param: null,
              cap: 'project',
              spentUsd: config.spend.tracker.projectSpent?.(projectId, projectCap) ?? 0,
              ...(config.spend.topUpUrl ? { topUpUrl: config.spend.topUpUrl } : {}),
            },
          },
          402,
        )
      }
      if (config.spend.tracker.check(spendKey, estimate) === 'block') {
        return c.json(
          {
            error: {
              message: 'Spend ceiling exceeded for this key. Reset the breaker or top up to continue.',
              type: 'spend_ceiling_exceeded',
              code: null,
              param: null,
              cap: 'key',
              spentUsd: config.spend.tracker.spent(spendKey),
              ...(config.spend.topUpUrl ? { topUpUrl: config.spend.topUpUrl } : {}),
            },
          },
          402,
        )
      }
    }
    /** Record actual spend after the request completes (never blocks). */
    const recordSpend = (costUsd: number | undefined): void => {
      if (!config.spend || !spendKey || !costUsd || costUsd <= 0) return
      config.spend.tracker.record(spendKey, costUsd)
      const projectCap = config.spend.project
      if (projectCap) {
        config.spend.tracker.recordProject?.(projectCap.id ?? 'default', projectCap, costUsd)
      }
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
    // An explicitly named catalog model is honored exactly; `auto` (or unset)
    // routes by strategy with the auto-tier quality floor.
    const explicitHints = explicitModelHints(config, body.model, params)
    if (explicitHints) params.routingHints = explicitHints
    // A tenant/project-scoped key attributes the request to its account — so
    // the caller's traffic ties to the right tenant, project, and wallet.
    if (auth.account) {
      params.metadata = {
        ...(params.metadata ?? {}),
        userId: auth.account.projectId ?? auth.account.userId,
        tenantId: auth.account.tenantId,
        projectId: auth.account.projectId,
        apiKeyId: auth.account.userId,
        apiKeyLabel: auth.account.label,
      }
    }
    const id = requestId()
    const ctx: RequestContext = { id }

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
          let meterChars = 0
          let meterUsage: { inputTokens: number; outputTokens: number } | undefined
          let guardText = ''
          await als.run(ctx, async () => {
            for await (const event of tstream) {
              if (upto) {
                if (event.type === 'text_delta') meterChars += event.text.length
                const usage = (event as { usage?: { inputTokens: number; outputTokens: number } }).usage
                if (usage) meterUsage = usage
              }
              if (config.guardrails && event.type === 'text_delta') guardText += event.text
              for (const chunk of encoder.forEvent(event)) {
                await stream.writeSSE({ data: JSON.stringify(chunk) })
              }
            }
          })
          await finish(ctx)
          if (config.guardrails && guardText) {
            evaluateGuardrails(config, id, params, guardText, ctx.model)
          }
          let uptoPayment: UptoSettlement | undefined
          if (upto) {
            const charge = uptoCharge(
              config.x402!,
              meterUsage ? meterUsage.inputTokens + meterUsage.outputTokens : undefined,
              meterChars,
            )
            uptoPayment = await settleUptoSafe(config, upto, charge)
          }
          if (exposeCost && (ctx.model || ctx.costUsd !== undefined)) {
            // Cost telemetry rides on a VALID chunk shape (empty choices — the
            // same shape OpenAI uses for usage-only chunks). A bare
            // {x_shipyard} frame fails strict client validation (e.g. the
            // Vercel AI SDK's OpenAI provider logs AI_TypeValidationError per
            // response), while extra keys on a valid chunk pass through.
            await stream.writeSSE({
              data: JSON.stringify({
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [],
                x_shipyard: {
                  model: ctx.model,
                  provider: ctx.provider,
                  costUsd: ctx.costUsd,
                  ...(ctx.failover
                    ? {
                        failover: {
                          from: ctx.failover.from,
                          ...(ctx.failover.to ? { to: ctx.failover.to } : {}),
                          reason: ctx.failover.reason,
                        },
                      }
                    : {}),
                  ...(ctx.routing
                    ? {
                        routing: ctx.routing,
                      }
                    : {}),
                  ...(uptoPayment
                    ? {
                        payment: {
                          amountBaseUnits: uptoPayment.amountBaseUnits.toString(),
                          signature: uptoPayment.transaction,
                        },
                      }
                    : {}),
                },
              }),
            })
          }
          await stream.writeSSE({ data: '[DONE]' })
          recordSpend(ctx.costUsd)
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
        if (ctx.routing) {
          c.header('x-shipyard-tier', ctx.routing.tier)
          c.header('x-shipyard-tier-source', ctx.routing.source)
          if (ctx.routing.confidence !== undefined)
            c.header('x-shipyard-jev-confidence', String(ctx.routing.confidence))
        }
      }
      if (upto) {
        const tokens = res.usage ? res.usage.inputTokens + res.usage.outputTokens : undefined
        const contentChars = JSON.stringify(res).length
        const settlement = await settleUptoSafe(config, upto, uptoCharge(config.x402!, tokens, contentChars))
        if (settlement) {
          c.header('x-payment-response', settlement.responseHeader)
          c.header('x-shipyard-billed-base-units', settlement.amountBaseUnits.toString())
        }
      }
      if (config.guardrails && res.content) {
        evaluateGuardrails(config, id, params, res.content, ctx.model)
      }
      recordSpend(ctx.costUsd)
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
    const auth = await authOrPayment(
      config,
      anthropicAuth(c),
      paymentHeaderOf(c),
      '/v1/messages',
      c.req.url,
    )
    if (auth instanceof Response) return auth
    if (!auth.ok) return c.json(anthropicAuthError, 401)
    const upto = auth.upto

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
    // Honor an explicitly named catalog model (mirrors /v1/chat/completions).
    const explicitHints = explicitModelHints(config, body.model, params)
    if (explicitHints) params.routingHints = explicitHints
    if (auth.account?.userId) params.metadata = { ...(params.metadata ?? {}), userId: auth.account.userId }
    const id = `msg_${randomBytes(12).toString('hex')}`
    const ctx: RequestContext = { id }

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
          let meterChars = 0
          let meterUsage: { inputTokens: number; outputTokens: number } | undefined
          let guardText = ''
          await als.run(ctx, async () => {
            for await (const event of tstream) {
              if (upto) {
                if (event.type === 'text_delta') meterChars += event.text.length
                const usage = (event as { usage?: { inputTokens: number; outputTokens: number } }).usage
                if (usage) meterUsage = usage
              }
              if (config.guardrails && event.type === 'text_delta') guardText += event.text
              for (const f of encoder.forEvent(event)) {
                await stream.writeSSE({ event: f.event, data: f.data })
              }
            }
          })
          await finish(ctx)
          if (config.guardrails && guardText) {
            evaluateGuardrails(config, id, params, guardText, ctx.model)
          }
          if (upto) {
            // Settlement is server-side (headers already streamed); the payer
            // sees the amount on the channel receipt. Best-effort by design.
            const charge = uptoCharge(
              config.x402!,
              meterUsage ? meterUsage.inputTokens + meterUsage.outputTokens : undefined,
              meterChars,
            )
            await settleUptoSafe(config, upto, charge)
          }
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
        if (ctx.routing) {
          c.header('x-shipyard-tier', ctx.routing.tier)
          c.header('x-shipyard-tier-source', ctx.routing.source)
          if (ctx.routing.confidence !== undefined)
            c.header('x-shipyard-jev-confidence', String(ctx.routing.confidence))
        }
      }
      if (upto) {
        const tokens = res.usage ? res.usage.inputTokens + res.usage.outputTokens : undefined
        const contentChars = JSON.stringify(res).length
        const settlement = await settleUptoSafe(config, upto, uptoCharge(config.x402!, tokens, contentChars))
        if (settlement) {
          c.header('x-payment-response', settlement.responseHeader)
          c.header('x-shipyard-billed-base-units', settlement.amountBaseUnits.toString())
        }
      }
      if (config.guardrails && res.content) {
        evaluateGuardrails(config, id, params, res.content, ctx.model)
      }
      return c.json(llmResponseToAnthropicMessage(res, body.model, id))
    } catch (err) {
      const { status, body: errBody } = toAnthropicError(err)
      return c.json(errBody, status as 400)
    }
  })

  // ── Typed decisions — System One models (e.g. TypeSafe Jev) ────────────────
  // State + typed questions in; probabilistic typed answers out — the "smart
  // if-statement" API, sold through the same auth/x402 as chat. This is the
  // product surface for decision models on Shipyard Inference: a developer
  // never needs a separate account, they pay through the gateway they know.

  // Judgment-loop calibration: per-tier quality (does economy routing actually
  // degrade answers?), Jev fallback rate/latency/cost, cache hits. Read-only
  // aggregate; enabled only when a `decisionFeedback` recorder is configured.
  app.get('/v1/decisions/feedback', async (c) => {
    if (!config.decisionFeedback?.report) {
      return errorJson(c, 404, 'Decision feedback is not enabled on this gateway', 'invalid_request_error')
    }
    try {
      const report = await config.decisionFeedback.report()
      return c.json(report)
    } catch {
      return errorJson(c, 503, 'Decision feedback report failed', 'api_error')
    }
  })

  app.post('/v1/decisions', async (c) => {
    if (!config.decisions) {
      return errorJson(c, 404, 'Decisions route is not enabled on this gateway', 'invalid_request_error')
    }
    const auth = await authOrPayment(
      config,
      c.req.header('authorization'),
      paymentHeaderOf(c),
      '/v1/decisions',
      c.req.url,
    )
    if (auth instanceof Response) return auth
    if (!auth.ok) return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    const upto = auth.upto

    let body: { state?: unknown; questions?: Record<string, DecisionQuestion>; model?: string }
    try {
      body = (await c.req.json()) as typeof body
    } catch {
      return errorJson(c, 400, 'Invalid JSON body', 'invalid_request_error')
    }
    if (!body || body.state === undefined) {
      return errorJson(c, 400, '`state` is required', 'invalid_request_error')
    }
    if (!body.questions || typeof body.questions !== 'object' || Object.keys(body.questions).length === 0) {
      return errorJson(c, 400, '`questions` must be a non-empty object of typed questions', 'invalid_request_error')
    }
    for (const [id, q] of Object.entries(body.questions)) {
      if (!q || (q.type !== 'choice' && q.type !== 'score' && q.type !== 'noul') || typeof q.instructions !== 'string') {
        return errorJson(
          c,
          400,
          `Question '${id}' must be one of type 'choice' | 'score' | 'noul' with string 'instructions'`,
          'invalid_request_error',
        )
      }
      // Per-type criteria shape: reject malformed input with a 400 BEFORE it
      // reaches the backend (otherwise it surfaces as a 502 server error).
      if (q.type === 'choice' && (typeof q.criteria !== 'object' || q.criteria === null || Array.isArray(q.criteria) || Object.keys(q.criteria).length === 0)) {
        return errorJson(c, 400, `Question '${id}' (choice) needs a non-empty criteria object mapping option ids to descriptions`, 'invalid_request_error')
      }
      if (q.type === 'score' && (!Array.isArray(q.criteria) || q.criteria.length === 0 || !q.criteria.every((l) => typeof l === 'string'))) {
        return errorJson(c, 400, `Question '${id}' (score) needs a non-empty criteria array of ordered level descriptions`, 'invalid_request_error')
      }
    }

    try {
      const res = await config.decisions!.provider.decide({
        state: body.state,
        questions: body.questions,
        model: body.model,
      })
      if (exposeCost) {
        c.header('x-shipyard-model', res.model)
        // A chain tags which member actually answered — prefer that over the
        // configured provider id (which may be "chain(a → b → stub)").
        c.header('x-shipyard-provider', res.provider ?? config.decisions!.provider.id)
      }
      if (upto) {
        // Metered billing on the decision's own reported usage; the decision
        // backend's output tokens are free at cost, but the caller's charge
        // follows the gateway's per-token price over metered tokens.
        const tokens = res.usage ? res.usage.inputTokens + res.usage.outputTokens : undefined
        const settlement = await settleUptoSafe(config, upto, uptoCharge(config.x402!, tokens, JSON.stringify(res).length))
        if (settlement) {
          c.header('x-payment-response', settlement.responseHeader)
          c.header('x-shipyard-billed-base-units', settlement.amountBaseUnits.toString())
        }
      }
      return c.json(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return errorJson(c, 502, `Decision failed: ${msg}`, 'server_error')
    }
  })

  // ── Video generation routes — Venice async API (queue → poll → retrieve) ───
  // These proxy to the Router's `video` surface (VideoRouter). The same
  // x-shipyard-* headers are exposed for telemetry. Auth is the same as chat.

  app.post('/v1/video/queue', async (c) => {
    const auth = await resolveAuth(config, c.req.header('authorization'))
    if (!auth.ok) return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    let body: VideoQueueParams
    try {
      body = (await c.req.json()) as VideoQueueParams
    } catch {
      return errorJson(c, 400, 'Invalid JSON body', 'invalid_request_error')
    }
    if (!body?.model || !body?.prompt) {
      return errorJson(c, 400, '`model` and `prompt` are required', 'invalid_request_error')
    }
    try {
      const result = await router.video.queue(body)
      if (exposeCost) {
        c.header('x-shipyard-model', result.model)
        c.header('x-shipyard-provider', 'venice-video')
      }
      return c.json({
        model: result.model,
        queue_id: result.queueId,
        download_url: result.downloadUrl,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return errorJson(c, 502, `Video queue failed: ${msg}`, 'server_error')
    }
  })

  app.post('/v1/video/retrieve', async (c) => {
    const auth = await resolveAuth(config, c.req.header('authorization'))
    if (!auth.ok) return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    let body: VideoRetrieveParams
    try {
      body = (await c.req.json()) as VideoRetrieveParams
    } catch {
      return errorJson(c, 400, 'Invalid JSON body', 'invalid_request_error')
    }
    if (!body?.model || !body?.queueId) {
      return errorJson(c, 400, '`model` and `queue_id` are required', 'invalid_request_error')
    }
    try {
      const result = await router.video.retrieve({
        model: body.model,
        queueId: body.queueId,
        downloadUrl: body.downloadUrl,
      })
      if (result.status === 'COMPLETED' && result.videoData) {
        // Return inline binary for completed inline videos
        if (exposeCost) {
          c.header('x-shipyard-model', body.model)
          c.header('x-shipyard-provider', 'venice-video')
        }
        return new Response(result.videoData, {
          status: 200,
          headers: { 'content-type': 'video/mp4' },
        })
      }
      return c.json({
        status: result.status,
        download_url: result.downloadUrl,
        average_execution_time: result.averageExecutionTime,
        execution_duration: result.executionDuration,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return errorJson(c, 502, `Video retrieve failed: ${msg}`, 'server_error')
    }
  })

  app.post('/v1/video/complete', async (c) => {
    const auth = await resolveAuth(config, c.req.header('authorization'))
    if (!auth.ok) return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    let body: VideoCompleteParams
    try {
      body = (await c.req.json()) as VideoCompleteParams
    } catch {
      return errorJson(c, 400, 'Invalid JSON body', 'invalid_request_error')
    }
    if (!body?.model || !body?.queueId) {
      return errorJson(c, 400, '`model` and `queue_id` are required', 'invalid_request_error')
    }
    try {
      await router.video.complete(body)
      return c.json({ success: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return errorJson(c, 502, `Video complete failed: ${msg}`, 'server_error')
    }
  })

  app.post('/v1/video/generate', async (c) => {
    const auth = await resolveAuth(config, c.req.header('authorization'))
    if (!auth.ok) return errorJson(c, 401, 'Invalid API key', 'authentication_error')
    let body: VideoGenerateParams
    try {
      body = (await c.req.json()) as VideoGenerateParams
    } catch {
      return errorJson(c, 400, 'Invalid JSON body', 'invalid_request_error')
    }
    if (!body?.model || !body?.prompt) {
      return errorJson(c, 400, '`model` and `prompt` are required', 'invalid_request_error')
    }
    try {
      const result = await router.video.generate(body)
      if (exposeCost) {
        c.header('x-shipyard-model', result.model)
        c.header('x-shipyard-provider', 'venice-video')
        if (result.costUsd !== undefined) {
          c.header('x-shipyard-cost-usd', String(result.costUsd))
        }
      }
      return c.json({
        model: result.model,
        queue_id: result.queueId,
        download_url: result.downloadUrl,
        video_data: result.videoData,
        cost_usd: result.costUsd,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return errorJson(c, 502, `Video generation failed: ${msg}`, 'server_error')
    }
  })

  return app
}
