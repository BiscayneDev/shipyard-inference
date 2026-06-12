import { homedir } from 'node:os'
import { join } from 'node:path'

// One-command install for the consumer surface. The kickbacks.ai equivalent for
// a CLI agent: instead of "install extension + Google sign-in", a developer runs
// `npx shipyard-inference connect` and their agent (Claude Code) is wired to
// route through Shipyard — no manual key paste, no env-var fiddling.

export interface ClaudeSettings {
  env?: Record<string, string>
  statusLine?: { type: string; command: string; padding?: number }
  [k: string]: unknown
}

/** Where Claude Code reads user settings. */
export function claudeSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json')
}

/**
 * Merge Shipyard wiring into a Claude Code settings object WITHOUT clobbering the
 * user's other settings: set the Anthropic base URL + auth token in `env`, and
 * (only if they have none) a Shipyard status line showing live earnings.
 */
export function mergeClaudeSettings(
  existing: ClaudeSettings,
  opts: { baseUrl: string; token: string; statusLineCommand?: string },
): ClaudeSettings {
  const next: ClaudeSettings = { ...existing }
  next.env = {
    ...(existing.env ?? {}),
    ANTHROPIC_BASE_URL: opts.baseUrl,
    ANTHROPIC_AUTH_TOKEN: opts.token,
  }
  // Don't overwrite a status line the user already configured.
  if (opts.statusLineCommand && !existing.statusLine) {
    next.statusLine = { type: 'command', command: opts.statusLineCommand, padding: 0 }
  }
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
  if (!res.ok) throw new Error(`key issue failed: ${res.status} ${await res.text().catch(() => '')}`)
  return (await res.json()) as { key: string; userId: string; wallet: string | null }
}

export interface Earnings {
  requests: number
  spentUsd: number
  savedUsd: number
  savedPct: number
  kickbacksUsd: number
}

/** Fetch the developer's earnings for the status line (fast, with a timeout). */
export async function fetchEarnings(
  gatewayUrl: string,
  key: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Earnings | null> {
  const f = opts.fetchImpl ?? fetch
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 1500)
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

/** The one-line status shown in Claude Code's status bar (kickbacks-style). */
export function formatStatusLine(e: Earnings | null): string {
  if (!e) return '⚓ Shipyard'
  const saved = `saved $${e.savedUsd.toFixed(4)}${e.savedPct ? ` (${e.savedPct}%)` : ''}`
  const kick = e.kickbacksUsd > 0 ? ` · kickbacks $${e.kickbacksUsd.toFixed(4)}` : ''
  return `⚓ Shipyard · ${saved}${kick}`
}
