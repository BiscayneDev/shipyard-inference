#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  claudeSettingsPath,
  mergeClaudeSettings,
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

  const path = claudeSettingsPath()
  const merged = mergeClaudeSettings(readSettings(path), {
    baseUrl: url,
    token: key,
    statusLineCommand: has('--no-statusline') ? undefined : STATUSLINE_CMD,
  })
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n')

  process.stdout.write(
    `\n✓ Shipyard connected to Claude Code.\n` +
      `  ${path}\n` +
      `  ANTHROPIC_BASE_URL = ${url}\n` +
      `  ANTHROPIC_AUTH_TOKEN = ${key.slice(0, 16)}…\n\n` +
      `Run \`claude\` — your traffic now routes through Shipyard (cheapest-capable\n` +
      `model = savings) and your wait-time earns kickbacks.${wallet ? '' : '\n  Tip: re-run with --wallet <addr> to set a payout wallet.'}\n` +
      `  Earnings: ${url}/me\n`,
  )
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
  // Claude Code runs this with the configured env block in scope; fall back to
  // the settings file if the vars aren't present.
  let url = process.env.ANTHROPIC_BASE_URL
  let key = process.env.ANTHROPIC_AUTH_TOKEN
  if (!url || !key) {
    const s = readSettings(claudeSettingsPath())
    url = url ?? s.env?.ANTHROPIC_BASE_URL
    key = key ?? s.env?.ANTHROPIC_AUTH_TOKEN
  }
  if (!url || !key) {
    process.stdout.write('⚓ Shipyard')
    return
  }
  const line = formatStatusLine(await fetchEarnings(url, key))
  writeCache(line)
  process.stdout.write(line)
}

async function main(): Promise<void> {
  const cmd = process.argv[2]
  if (cmd === 'connect') return connect()
  if (cmd === 'statusline') return statusline()
  process.stderr.write(
    'Shipyard Inference — route your agent through Shipyard for cheaper inference + kickbacks.\n\n' +
      'Usage:\n' +
      '  npx shipyard-inference connect [--url <gateway>] [--wallet <addr>] [--key <sk-…>] [--no-statusline]\n' +
      '      Wire Claude Code to route through Shipyard (writes ~/.claude/settings.json).\n' +
      '  npx shipyard-inference statusline\n' +
      '      Print the live-earnings status line (used by Claude Code).\n',
  )
  process.exit(cmd ? 1 : 0)
}

main().catch((err) => {
  process.stderr.write(`shipyard connect failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
