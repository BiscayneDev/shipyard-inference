import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { checkBearer } from '../gateway/auth.js'
import type { TelemetryHub } from './hub.js'
import type { IngestPayload } from './types.js'

export interface OperatorConsoleOptions {
  hub: TelemetryHub
  /** Bearer tokens reporters present to `POST /ingest`. Empty ⇒ open (dev only). */
  ingestTokens?: string[]
  /** Bearer tokens the operator presents to `GET /api/*`. Empty ⇒ open (dev only). */
  operatorTokens?: string[]
  cors?: { origins: string[] | '*' }
  /** Whether the billing panel is wired (treasury configured). Surfaced in `/api/meta`. */
  treasuryConfigured?: boolean
}

const STATIC: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
}

const HERE = dirname(fileURLToPath(import.meta.url))

/** Parse `?window=` — a shorthand like `15m`/`6h`/`2d` or a raw ms number. */
export function parseWindowMs(raw: string | undefined, fallback = 3_600_000): number {
  if (!raw) return fallback
  const m = /^(\d+(?:\.\d+)?)([smhd])$/.exec(raw.trim())
  if (m) {
    const n = Number(m[1])
    const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]!
    return n * unit
  }
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Build the operator command-center app as a Hono app — pure and port-free, so
 * it can be mounted onto an existing gateway or exercised in-process via
 * `app.request(...)` (mirrors `createGatewayApp`). `POST /ingest` is gated by the
 * ingest token; every `GET /api/*` by the operator token. The static SPA shell is
 * unauthenticated (it prompts for the operator token and sends it as a bearer).
 */
export function createOperatorConsole(opts: OperatorConsoleOptions): Hono {
  const { hub } = opts
  if (!opts.operatorTokens || opts.operatorTokens.length === 0) {
    console.warn(
      '[shipyard-operator] no operator tokens set — the dashboard API is OPEN. ' +
        'Set SHIPYARD_OPERATOR_TOKEN for anything but local dev.',
    )
  }

  const app = new Hono()
  app.use('*', cors({ origin: opts.cors?.origins ?? '*' }))

  app.get('/healthz', (c) => c.json({ status: 'ok' }))

  // --- ingest (write) ------------------------------------------------------
  app.post('/ingest', async (c) => {
    if (!checkBearer(opts.ingestTokens, c.req.header('authorization'))) {
      return c.json({ error: 'invalid ingest token' }, 401)
    }
    let body: IngestPayload
    try {
      body = (await c.req.json()) as IngestPayload
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400)
    }
    if (!body || typeof body.source !== 'string' || !Array.isArray(body.events)) {
      return c.json({ error: '`source` and `events[]` are required' }, 400)
    }
    const accepted = await hub.ingest(body.source, body.events)
    return c.json({ accepted })
  })

  // --- dashboard API (read) ------------------------------------------------
  const api = new Hono()
  api.use('*', async (c, next) => {
    if (!checkBearer(opts.operatorTokens, c.req.header('authorization'))) {
      return c.json({ error: 'invalid operator token' }, 401)
    }
    await next()
  })

  const window = (c: Context): number => parseWindowMs(c.req.query('window'))
  const source = (c: Context): string | undefined => c.req.query('source') || undefined

  api.get('/meta', (c) =>
    c.json({
      marginPct: hub.marginPct,
      treasuryConfigured: opts.treasuryConfigured ?? false,
      sources: hub.knownSources(),
      windows: ['15m', '1h', '6h', '24h', '48h'],
    }),
  )
  api.get('/sources', (c) => c.json({ sources: hub.knownSources() }))
  api.get('/overview', (c) => c.json(hub.overview(window(c), source(c))))
  api.get('/timeseries', (c) => {
    const buckets = Number(c.req.query('buckets')) || 60
    return c.json(hub.timeseries(window(c), buckets, source(c)))
  })
  api.get('/breakdown', (c) => {
    const dim = (c.req.query('dimension') ?? 'model') as 'model' | 'provider' | 'user' | 'source'
    const allowed = ['model', 'provider', 'user', 'source']
    if (!allowed.includes(dim)) return c.json({ error: 'bad dimension' }, 400)
    return c.json(hub.breakdown(dim, window(c), source(c)))
  })
  api.get('/errors', (c) => c.json(hub.errors(window(c), source(c))))
  api.get('/feed', (c) => {
    const limit = Math.min(500, Number(c.req.query('limit')) || 100)
    return c.json(hub.feed(limit, source(c)))
  })
  api.get('/routing', (c) => c.json(hub.routingHealth(window(c), source(c))))
  api.get('/billing', (c) => c.json(hub.billing(window(c), source(c))))

  app.route('/api', api)

  // --- static SPA ----------------------------------------------------------
  app.get('*', async (c) => {
    const entry = STATIC[new URL(c.req.url).pathname]
    if (!entry) return c.notFound()
    const [file, type] = entry
    try {
      const buf = await readFile(join(HERE, 'public', file))
      return c.body(buf, 200, { 'content-type': type })
    } catch {
      return c.notFound()
    }
  })

  return app
}
