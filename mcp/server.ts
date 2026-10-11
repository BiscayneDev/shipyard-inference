/**
 * Shipyard Inference billing MCP server.
 *
 * A thin stdio MCP server whose tools are REST clients of the Shipyard
 * Inference gateway. Everything is configurable so tests can point it at a
 * mock gateway:
 *
 *   - gatewayUrl: arg override ?? SHIPYARD_GATEWAY_URL
 *   - gatewayKey: arg override ?? SHIPYARD_GATEWAY_KEY
 *
 * Tools:
 *   - shipyard_balance: credit balance via GET /api/me (`kickbacksUsd` — the
 *     gateway credits top-ups into the same durable CreditStore the tender
 *     kickbacks accrue into, so that field IS the balance). Older gateways
 *     without the shared ledger get a clear `not_exposed` error.
 *   - shipyard_usage: GET /api/me (key-authed usage breakdown: requests,
 *     spentUsd, savedUsd, kickbacks) projected to a compact JSON object.
 *   - shipyard_models: GET /v1/models.
 *
 * Run: node --import tsx mcp/server.ts
 * Errors are always returned as tool errors (compact JSON), never stack traces.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const USER_AGENT = 'shipyard-inference-mcp-billing/0.1'

/** HTTP failure from the gateway with a useful, bounded message. */
export class GatewayHttpError extends Error {
  status: number
  bodySnippet: string
  constructor(status: number, bodySnippet: string) {
    super(`gateway returned ${status}: ${bodySnippet}`)
    this.name = 'GatewayHttpError'
    this.status = status
    this.bodySnippet = bodySnippet
  }
}

async function readErrBody(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim()
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown }
      const msg = parsed.error ?? parsed.message
      if (typeof msg === 'string' && msg) return msg.slice(0, 200)
    } catch {
      // not JSON — fall through to raw text
    }
    return (text || res.statusText).slice(0, 200)
  } catch {
    return res.statusText
  }
}

/** GET (or other method) a gateway URL with the bearer key; parse JSON. */
export async function fetchGatewayJson(
  url: string,
  opts: { key: string; method?: string },
): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        authorization: `Bearer ${opts.key}`,
        'user-agent': USER_AGENT,
        accept: 'application/json',
      },
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`cannot reach gateway: ${reason.slice(0, 160)}`)
  }
  if (!res.ok) throw new GatewayHttpError(res.status, await readErrBody(res))
  return res.json()
}

/** Compact JSON string for tool content. */
function json(value: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] }
}

/** Wrap a tool body so any throw becomes an isError result with compact JSON. */
function safe(fn: () => Promise<unknown>): Promise<{
  content: { type: 'text'; text: string }[]
  isError?: boolean
}> {
  return fn().then(json).catch((err: unknown) => {
    let payload: Record<string, unknown>
    if (err instanceof GatewayHttpError) {
      payload = { error: 'gateway_error', status: err.status, message: err.bodySnippet || err.message }
    } else {
      payload = {
        error: 'network_error',
        message: (err instanceof Error ? err.message : String(err)).slice(0, 200),
      }
    }
    return { ...json(payload), isError: true }
  })
}

export type BillingServerOptions = {
  gatewayUrl?: string
  gatewayKey?: string
}

export function resolveConfig(opts: BillingServerOptions): { gatewayUrl: string; gatewayKey: string } {
  const gatewayUrl = (opts.gatewayUrl ?? process.env.SHIPYARD_GATEWAY_URL ?? '').replace(/\/+$/, '')
  const gatewayKey = opts.gatewayKey ?? process.env.SHIPYARD_GATEWAY_KEY ?? ''
  if (!gatewayUrl) throw new Error('gateway URL required: pass gatewayUrl or set SHIPYARD_GATEWAY_URL')
  if (!gatewayKey) throw new Error('gateway key required: pass gatewayKey or set SHIPYARD_GATEWAY_KEY')
  return { gatewayUrl, gatewayKey }
}

/** Build the billing MCP server (not yet connected to a transport). */
export function createBillingServer(opts: BillingServerOptions = {}): { server: McpServer } {
  const { gatewayUrl, gatewayKey } = resolveConfig(opts)
  const server = new McpServer({ name: 'shipyard-billing', version: '0.1.0' })

  server.registerTool(
    'shipyard_models',
    {
      description: 'List models available on the Shipyard Inference gateway (GET /v1/models).',
      inputSchema: z.object({}),
    },
    async () =>
      safe(async () => {
        const out = (await fetchGatewayJson(`${gatewayUrl}/v1/models`, { key: gatewayKey })) as {
          data?: { id?: string }[]
        }
        const models = (out.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
        return { models, count: models.length }
      }),
  )

  server.registerTool(
    'shipyard_usage',
    {
      description:
        'Recent usage for the configured gateway key: requests, spend, routing savings (gateway GET /api/me). Optional windowMs (default 24h).',
      inputSchema: z.object({
        windowMs: z.number().optional().describe('Usage window in milliseconds (default 86400000 = 24h)'),
      }),
    },
    async (args: { windowMs?: number } = {}) =>
      safe(async () => {
        const windowMs = args.windowMs
        const url = new URL(`${gatewayUrl}/api/me`)
        if (windowMs !== undefined) url.searchParams.set('windowMs', String(windowMs))
        const out = (await fetchGatewayJson(url.toString(), { key: gatewayKey })) as {
          account?: { userId?: string; wallet?: string | null; label?: string | null }
          windowMs?: number
          requests?: number
          spentUsd?: number
          baselineUsd?: number
          savedUsd?: number
          savedPct?: number
          kickbacksUsd?: number
        }
        return {
          account: out.account ?? null,
          windowMs: out.windowMs ?? null,
          requests: out.requests ?? null,
          spentUsd: out.spentUsd ?? null,
          baselineUsd: out.baselineUsd ?? null,
          savedUsd: out.savedUsd ?? null,
          savedPct: out.savedPct ?? null,
          kickbacksUsd: out.kickbacksUsd ?? null,
        }
      }),
  )

  server.registerTool(
    'shipyard_balance',
    {
      description:
        'Credit balance (SHIPusd) for the configured gateway key, via gateway GET /api/me (`kickbacksUsd` — top-ups and tender kickbacks share one durable credit ledger).',
      inputSchema: z.object({}),
    },
    async () =>
      safe(async () => {
        const out = (await fetchGatewayJson(`${gatewayUrl}/api/me`, { key: gatewayKey })) as {
          account?: { wallet?: string | null }
          kickbacksUsd?: number
        }
        if (typeof out.kickbacksUsd !== 'number') {
          return {
            error: 'not_exposed',
            message:
              'Gateway did not report a credit balance on /api/me (older gateway without a shared credit ledger).',
          }
        }
        return {
          balanceUsd: out.kickbacksUsd,
          wallet: out.account?.wallet ?? null,
        }
      }),
  )

  return { server }
}

/** Main entrypoint: connect the billing server over stdio. */
export async function main(): Promise<void> {
  const { server } = createBillingServer()
  await server.connect(new StdioServerTransport())
}

// Run only when executed directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).toString()
if (isMain) {
  main().catch((err: unknown) => {
    console.error(JSON.stringify({ error: 'fatal', message: String(err).slice(0, 200) }))
    process.exit(1)
  })
}
