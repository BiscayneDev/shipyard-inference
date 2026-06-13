#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  claudeSettingsPath,
  shipyardConfigPath,
  mergeClaudeSettings,
  applyShipyardSpinner,
  spinnerTips,
  fetchPlacementLines,
  issueKey,
  fetchEarnings,
  formatStatusLine,
  type ClaudeSettings,
} from './install.js'

const DEFAULT_URL = process.env.SHIPYARD_URL ?? 'https://shipyard-inference.vercel.app'
const STATUSLINE_CMD = 'npx -y shipyard-inference statusline'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const has = (name: string): boolean => process.argv.includes(name)

function readSettings(path: string): ClaudeSettings {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ClaudeSettings
  } catch {
    return {}
  }
}

async function connect(): Promise<void> {
  const url = (arg('--url') ?? DEFAULT_URL).replace(/\/+$/, '')
  const wallet = arg('--wallet')
  // Reuse an existing key (--key) or issue a fresh one.
  let key = arg('--key')
  if (!key) {
    process.stderr.write(`Issuing a Shipyard key from ${url}…\n`)
    const issued = await issueKey(url, { wallet })
    key = issued.key
  }

  // --route is opt-in: it's the ONLY mode that points Claude Code at the gateway
  // (takes over the model). Default leaves the user's model/inference untouched.
  const route = has('--route')

  // Seed the spinner tip (the in-wait ad) from the live auction inventory; the
  // statusline command refreshes it between turns thereafter.
  const [earnings, lines] = await Promise.all([
    fetchEarnings(url, key).catch(() => null),
    fetchPlacementLines(url).catch(() => []),
  ])

  const path = claudeSettingsPath()
  const merged = applyShipyardSpinner(
    mergeClaudeSettings(readSettings(path), {
      baseUrl: url,
      token: key,
      statusLineCommand: has('--no-statusline') ? undefined : STATUSLINE_CMD,
      route,
    }),
    spinnerTips(earnings, lines),
  )
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n')

  // Shipyard's own config — lets the status line show earnings without putting
  // creds in Claude Code's env (which would route/override the model).
  const cfgPath = shipyardConfigPath()
  mkdirSync(dirname(cfgPath), { recursive: true })
  writeFileSync(cfgPath, JSON.stringify({ url, key }) + '\n', { mode: 0o600 })

  const walletTip = wallet ? '' : '\n  Tip: re-run with --wallet <addr> to set a payout wallet.'
  if (route) {
    process.stdout.write(
      `\n✓ Shipyard connected to Claude Code — routing ON.\n` +
        `  ${path}\n` +
        `  ANTHROPIC_BASE_URL = ${url}\n` +
        `  ANTHROPIC_AUTH_TOKEN = ${key.slice(0, 16)}…\n\n` +
        `Run \`claude\` — your traffic now routes through Shipyard (cheapest-capable\n` +
        `model = savings) and your wait-time earns kickbacks.${walletTip}\n` +
        `  Earnings: ${url}/me\n`,
    )
  } else {
    process.stdout.write(
      `\n✓ Shipyard connected to Claude Code.\n` +
        `  ${path}\n\n` +
        `Your model and inference are UNTOUCHED — Claude Code keeps using your own\n` +
        `Anthropic key. A sponsored line now shows in Claude's spinner during waits,\n` +
        `plus a live-earnings status bar; your wait-time can earn kickbacks.${walletTip}\n` +
        `  Want cheaper inference too? Re-run with --route to route through Shipyard.\n` +
        `  Earnings: ${url}/me\n`,
    )
  }
}

// Claude Code re-renders the status line constantly; cache the result so we hit
// the gateway at most once per TTL instead of on every render.
const CACHE_PATH = join(homedir(), '.shipyard', 'statusline.json')
const CACHE_TTL_MS = 8000

function cachedLine(): string | undefined {
  try {
    const c = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as { at: number; line: string }
    if (Date.now() - c.at < CACHE_TTL_MS) return c.line
  } catch {
    /* no cache */
  }
  return undefined
}
function writeCache(line: string): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify({ at: Date.now(), line }))
  } catch {
    /* best effort */
  }
}

async function statusline(): Promise<void> {
  const fresh = cachedLine()
  if (fresh !== undefined) {
    process.stdout.write(fresh)
    return
  }
  // Routing mode puts these in env; otherwise read Shipyard's own config (written
  // by connect even when we don't route), then fall back to the settings env.
  let url = process.env.ANTHROPIC_BASE_URL
  let key = process.env.ANTHROPIC_AUTH_TOKEN
  if (!url || !key) {
    try {
      const cfg = JSON.parse(readFileSync(shipyardConfigPath(), 'utf8')) as { url?: string; key?: string }
      url = url ?? cfg.url
      key = key ?? cfg.key
    } catch {
      /* no shipyard config */
    }
  }
  if (!url || !key) {
    const s = readSettings(claudeSettingsPath())
    url = url ?? s.env?.ANTHROPIC_BASE_URL
    key = key ?? s.env?.ANTHROPIC_AUTH_TOKEN
  }
  if (!url || !key) {
    process.stdout.write('⚓ Shipyard')
    return
  }
  const [e, lines] = await Promise.all([fetchEarnings(url, key), fetchPlacementLines(url).catch(() => [])])
  const line = formatStatusLine(e)
  // Refresh the spinner ad (shown DURING the next wait) from the live auction.
  // Surgical write — only spinnerVerbs, never env.
  try {
    const sp = claudeSettingsPath()
    writeFileSync(sp, JSON.stringify(applyShipyardSpinner(readSettings(sp), spinnerTips(e, lines)), null, 2) + '\n')
  } catch {
    /* best effort */
  }
  // Report the impression — the ad is shown in this render, so the requester
  // earns their kickback WITHOUT routing inference. Server rate-limits + caps it.
  fetch(url.replace(/\/+$/, '') + '/api/tender/impression', { method: 'POST', headers: { authorization: `Bearer ${key}` } }).catch(() => {})
  writeCache(line)
  process.stdout.write(line)
}

async function main(): Promise<void> {
  const cmd = process.argv[2]
  if (cmd === 'connect') return connect()
  if (cmd === 'statusline') return statusline()
  process.stderr.write(
    'Shipyard Inference — earn on your agent idle-time; optionally route for cheaper inference.\n\n' +
      'Usage:\n' +
      '  npx shipyard-inference connect [--url <gateway>] [--wallet <addr>] [--key <sk-…>] [--route] [--no-statusline]\n' +
      '      Connect Claude Code to Shipyard. By default this adds a live-earnings\n' +
      '      status line and does NOT change your model. Pass --route to also route\n' +
      '      inference through Shipyard for cost savings (sets ANTHROPIC_BASE_URL).\n' +
      '  npx shipyard-inference statusline\n' +
      '      Print the live-earnings status line (used by Claude Code).\n',
  )
  process.exit(cmd ? 1 : 0)
}

main().catch((err) => {
  process.stderr.write(`shipyard connect failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
