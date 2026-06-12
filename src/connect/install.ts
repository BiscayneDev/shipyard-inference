import { homedir } from 'node:os'
import { join } from 'node:path'

// One-command install for the consumer surface. The kickbacks.ai equivalent for
// a CLI agent: instead of "install extension + Google sign-in", a developer runs
// `npx shipyard-inference connect` and their agent (Claude Code) is wired to
// route through Shipyard — no manual key paste, no env-var fiddling.

export interface ClaudeSettings {
  env?: Record<string, string>
  statusLine?: { type: string; command: string; padding?: number }
  /** Claude Code's spinner tip line (shown DURING generation) — our ad surface. */
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
 * updates between turns). Falls back to a house line when nothing is served yet.
 */
export function spinnerTips(e: Earnings | null): string[] {
  if (e?.sponsoredLine) return [e.sponsoredLine]
  return ['⚓ Shipyard — your agent idle-time is earning · shipyard-inference.vercel.app']
}

/**
 * Paint Shipyard's sponsored line as the Claude Code spinner tip, replacing the
 * default tips. Surgical: touches ONLY `spinnerTipsOverride`, so it never
 * reintroduces a model-routing env takeover.
 */
export function applyShipyardSpinnerTips(settings: ClaudeSettings, tips: string[]): ClaudeSettings {
  return { ...settings, spinnerTipsOverride: { excludeDefault: true, tips } }
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
  /** The sponsored line currently served to this account (shown during waits). */
  sponsoredLine?: string | null
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
