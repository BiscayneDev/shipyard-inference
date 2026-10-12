import { homedir } from 'node:os'
import { join } from 'node:path'

// One-command install for the consumer surface. The kickbacks.ai equivalent for
// a CLI agent: instead of "install extension + Google sign-in", a developer runs
// `npx shipyard-inference connect` and their agent (Claude Code) is wired to
// route through Shipyard — no manual key paste, no env-var fiddling.

export interface ClaudeSettings {
  env?: Record<string, string>
  statusLine?: { type: string; command: string; padding?: number }
  /** Claude Code's spinner VERB (the orange line itself) — replace with the ad. */
  spinnerVerbs?: { mode: 'append' | 'replace'; verbs: string[] }
  /** Claude Code's spinner tip line (shown below, DURING generation) — also ours. */
  spinnerTipsOverride?: { excludeDefault?: boolean; tips: string[] }
  [k: string]: unknown
}

/** Where Claude Code reads user settings. */
export function claudeSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json')
}

/**
 * Shipyard's own per-user config (gateway URL + key). The status line reads this
 * to show earnings WITHOUT putting anything in Claude Code's `env` — because an
 * `ANTHROPIC_BASE_URL` in `env` would route (take over) the user's model. By
 * default connecting must NOT do that.
 */
export function shipyardConfigPath(): string {
  return join(homedir(), '.shipyard', 'config.json')
}

/**
 * Merge Shipyard wiring into a Claude Code settings object WITHOUT clobbering the
 * user's other settings.
 *
 * By DEFAULT this does not touch the model: it adds only a live-earnings status
 * line (Shipyard reads its key from `shipyardConfigPath()`, not `env`). It also
 * strips a routing takeover a *prior* connect may have written — but only
 * Shipyard's own `ANTHROPIC_*` entries, never the user's own.
 *
 * Pass `route: true` to opt into routing Claude Code's inference through Shipyard
 * (the only mode that sets `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`).
 */
export function mergeClaudeSettings(
  existing: ClaudeSettings,
  opts: { baseUrl: string; token: string; statusLineCommand?: string; route?: boolean },
): ClaudeSettings {
  const next: ClaudeSettings = { ...existing }
  if (opts.route) {
    next.env = {
      ...(existing.env ?? {}),
      ANTHROPIC_BASE_URL: opts.baseUrl,
      ANTHROPIC_AUTH_TOKEN: opts.token,
    }
  } else {
    // No takeover. Remove a routing env Shipyard previously wrote, leaving the
    // user's own entries (and any non-Shipyard ANTHROPIC_*) intact.
    const env = { ...(existing.env ?? {}) }
    if (typeof env.ANTHROPIC_AUTH_TOKEN === 'string' && env.ANTHROPIC_AUTH_TOKEN.startsWith('sk-shipyard-')) {
      delete env.ANTHROPIC_AUTH_TOKEN
      if (typeof env.ANTHROPIC_BASE_URL === 'string' && /shipyard/i.test(env.ANTHROPIC_BASE_URL)) delete env.ANTHROPIC_BASE_URL
    }
    if (Object.keys(env).length) next.env = env
    else delete next.env
  }
  // Don't overwrite a status line the user already configured.
  if (opts.statusLineCommand && !existing.statusLine) {
    next.statusLine = { type: 'command', command: opts.statusLineCommand, padding: 0 }
  }
  return next
}

/**
 * The sponsored line(s) to paint as Claude Code's spinner tip — the in-IDE ad,
 * shown DURING a generation wait (unlike the bottom status bar, which only
 * updates between turns). Prefers the live auction inventory (the funded
 * advertiser campaigns), so paid placements show even without routing; falls back
 * to the account's served line, then a house line.
 */
export function spinnerTips(e: Earnings | null, placementLines: string[] = []): string[] {
  if (placementLines.length) return placementLines
  if (e?.sponsoredLine) return [e.sponsoredLine]
  return ['⚓ Shipyard — your agent idle-time is earning · shipyard-inference.vercel.app']
}

/**
 * Fetch the live auction inventory (funded campaigns) as sponsored lines, highest
 * bid first — the ads that rotate in the spinner. Public endpoint, no key needed.
 */
export async function fetchPlacementLines(
  gatewayUrl: string,
  opts: { limit?: number; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<string[]> {
  const f = opts.fetchImpl ?? fetch
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 1500)
  try {
    const res = await f(`${trimSlashes(gatewayUrl)}/api/campaigns`, { signal: ac.signal })
    if (!res.ok) return []
    const data = (await res.json()) as { campaigns?: Array<{ line?: unknown; usdcPerImpression?: number }> }
    return (data.campaigns ?? [])
      .filter((c): c is { line: string; usdcPerImpression?: number } => typeof c.line === 'string' && c.line.trim().length > 0)
      .sort((a, b) => (b.usdcPerImpression ?? 0) - (a.usdcPerImpression ?? 0))
      .slice(0, opts.limit ?? 5)
      .map((c) => c.line)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Take over Claude Code's spinner with the sponsored line(s): replace the spinner
 * VERB (the orange line itself — so the ad rotates where "Puttering…" was). The
 * ad lives ONLY on that one line — Claude's own tip line is left alone so the ad
 * never appears twice. The `✶` star and the `(3s · tokens · thinking)` metrics
 * are hardcoded by Claude Code and cannot be removed. Surgical: touches only
 * `spinnerVerbs`, and clears any prior `spinnerTipsOverride` Shipyard wrote.
 */
export function applyShipyardSpinner(settings: ClaudeSettings, lines: string[]): ClaudeSettings {
  const next: ClaudeSettings = { ...settings, spinnerVerbs: { mode: 'replace', verbs: lines } }
  delete next.spinnerTipsOverride // ad belongs on the verb line only — never both
  return next
}

const trimSlashes = (u: string): string => u.replace(/\/+$/, '')

/** Issue a fresh per-user key from the gateway (anonymous; optional payout wallet). */
export async function issueKey(
  gatewayUrl: string,
  opts: { wallet?: string; label?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ key: string; userId: string; wallet: string | null }> {
  const f = opts.fetchImpl ?? fetch
  const res = await f(`${trimSlashes(gatewayUrl)}/api/keys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: opts.wallet, label: opts.label ?? 'claude-code' }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let closed: string | undefined
    try {
      const j = JSON.parse(text) as { code?: string; error?: string }
      if (j.code === 'self_serve_closed') closed = j.error
    } catch {
      // not JSON; fall through to the generic error
    }
    if (closed) throw new Error(closed)
    throw new Error(`key issue failed: ${res.status} ${text}`)
  }
  return (await res.json()) as { key: string; userId: string; wallet: string | null }
}

export interface Earnings {
  requests: number
  spentUsd: number
  savedUsd: number
  savedPct: number
  kickbacksUsd: number
  /** The sponsored line currently served to this account (shown during waits). */
  sponsoredLine?: string | null
}

/** Encode bytes as base58 (used for Solana pubkey + Ed25519 signatures). */
function b58(input: Uint8Array): string {
  const CH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let n = 0n
  for (const b of input) n = (n << 8n) | BigInt(b)
  let s = ''
  while (n > 0n) {
    s = CH[Number(n % 58n)] + s
    n /= 58n
  }
  for (const b of input) {
    if (b === 0) s = '1' + s
    else break
  }
  return s
}

/**
 * Mint a wallet-bound key from the CLI — the SAME signature-is-auth path the
 * /connect page uses, but with the caller supplying a Solana secret key (base58
 * 32-byte seed). Fetches a fresh challenge, signs it Ed25519, POSTs to
 * /v1/keys/wallet. No self-serve gate, no signup — proving the wallet is login.
 */
export async function mintWalletKey(
  gatewayUrl: string,
  secretKeyB58: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<{ key: string; wallet: string }> {
  const f = opts.fetchImpl ?? fetch
  const bs58 = (await import('bs58')).default
  const seed = new Uint8Array(bs58.decode(secretKeyB58))
  if (seed.length !== 32) throw new Error(`wallet secret must be a 32-byte base58 seed (got ${seed.length} bytes)`)
  const { createPrivateKey, createPublicKey, sign } = await import('node:crypto')

  // 1. Derive pubkey + fetch the deterministic message to sign.
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(seed)])
  const priv = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })
  const pubJwk = createPublicKey(priv).export({ format: 'jwk' })
  const pubkey = b58(Buffer.from(pubJwk.x as string, 'base64url'))

  const chRes = await f(`${trimSlashes(gatewayUrl)}/v1/keys/wallet/challenge?pubkey=${encodeURIComponent(pubkey)}`)
  const ch = (await chRes.json()) as { nonce?: string; message?: string; error?: { message?: string } }
  if (!chRes.ok || !ch.nonce || !ch.message) throw new Error(ch.error?.message ?? `challenge failed: ${chRes.status}`)

  // 2. Sign the exact challenge message with Ed25519.
  const signature = b58(sign(null, Buffer.from(ch.message, 'utf8'), priv))

  // 3. Mint the key (signature IS the auth).
  const mintRes = await f(`${trimSlashes(gatewayUrl)}/v1/keys/wallet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pubkey, nonce: ch.nonce, signature }),
  })
  const body = (await mintRes.json()) as { key?: string; wallet?: string; error?: { message?: string } }
  if (!mintRes.ok || !body.key) throw new Error(body.error?.message ?? `key mint failed: ${mintRes.status}`)
  return { key: body.key, wallet: body.wallet ?? pubkey }
}

/** Fetch the developer's earnings for the status line (fast, with a timeout). */
export async function fetchEarnings(
  gatewayUrl: string,
  key: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Earnings | null> {
  const f = opts.fetchImpl ?? fetch
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 4000)
  try {
    const res = await f(`${trimSlashes(gatewayUrl)}/api/me`, {
      headers: { authorization: `Bearer ${key}` },
      signal: ac.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as Earnings
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The one-line status shown in Claude Code's status bar (kickbacks-style). When a
 * sponsored line is being served (during a wait), it leads — that's the in-IDE ad
 * impression — with earnings trailing. Otherwise it's the earnings summary.
 */
export function formatStatusLine(e: Earnings | null): string {
  if (!e) return '⚓ Shipyard'
  if (e.sponsoredLine) {
    const earn = e.kickbacksUsd > 0 ? `+$${e.kickbacksUsd.toFixed(4)}` : `saved $${e.savedUsd.toFixed(4)}`
    return `${e.sponsoredLine}  ·  ⚓ ${earn}`
  }
  const saved = `saved $${e.savedUsd.toFixed(4)}${e.savedPct ? ` (${e.savedPct}%)` : ''}`
  const kick = e.kickbacksUsd > 0 ? ` · kickbacks $${e.kickbacksUsd.toFixed(4)}` : ''
  return `⚓ Shipyard · ${saved}${kick}`
}
