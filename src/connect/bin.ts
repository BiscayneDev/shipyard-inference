#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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
import { runDoctor } from './doctor.js'
import { resolveConnectTargets, keyReuseWarning } from './agent-wiring.js'
import { installService } from '../gateway/service.js'
import { mintWalletKey } from './install.js'

const DEFAULT_URL = process.env.SHIPYARD_URL ?? 'https://shipyard-inference.vercel.app'
const STATUSLINE_CMD = 'npx -y shipyard-inference statusline'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const has = (name: string): boolean => process.argv.includes(name)

/** Resolve the appliance repo root (where dist/ and local.gateway.config.mjs live). */
function applianceRepoDir(): string {
  const here = resolve(import.meta.dirname, '..', '..')
  return existsSync(resolve(here, 'local.gateway.config.mjs')) ? here : process.cwd()
}

/** Best-effort: register the gateway (+ ollama) as a launchd service. */
function installApplianceService(): void {
  const repoDir = applianceRepoDir()
  const programPath = resolve(repoDir, 'dist', 'gateway', 'bin.js')
  const configPath = resolve(repoDir, 'local.gateway.config.mjs')
  try {
    const result = installService({
      nodeBin: process.env.SHIPYARD_NODE_BIN ?? process.execPath,
      programPath,
      configPath,
      port: 8787,
      repoDir,
      withOllama: has('--with-ollama'),
    })
    process.stdout.write(
      `⚙  Installed launchd service (survives reboot + crash-restart):\n` +
        `    ${result.gatewayPlist}\n`,
    )
    if (result.ollamaPlist) process.stdout.write(`    ${result.ollamaPlist}\n`)
  } catch (err) {
    process.stdout.write(`⚠  Could not install launchd service: ${err instanceof Error ? err.message : String(err)}\n`)
  }
}

function readSettings(path: string): ClaudeSettings {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ClaudeSettings
  } catch {
    return {}
  }
}

async function connect(): Promise<void> {
  const local = has('--local')
  const url = local
    ? 'http://127.0.0.1:8787'
    : (arg('--url') ?? DEFAULT_URL).replace(/\/+$/, '')
  const wallet = arg('--wallet')
  // Repeatable --agent <kind>: print per-agent wiring after connecting.
  const agents = process.argv
    .map((a, i) => (a === '--agent' ? process.argv[i + 1] : undefined))
    .filter((a): a is 'claude' | 'openclaw' | 'env' => a === 'claude' || a === 'openclaw' || a === 'env')
  // Reuse an existing key (--key) or issue a fresh one.
  let key = arg('--key')
  if (!key) {
    // Wallet-native: mint a key bound to a provided Solana secret (base58 32-byte
    // seed) via the signature-is-auth endpoint — no self-serve gate, no signup.
    const walletKey = arg('--wallet-key')
    if (walletKey) {
      if (local) process.stderr.write(`Minting a wallet-bound key from ${url}…\n`)
      const minted = await mintWalletKey(url, walletKey)
      key = minted.key
    } else {
      process.stderr.write(`Issuing a Shipyard key from ${url}…\n`)
      const issued = await issueKey(url, { wallet: arg('--wallet') })
      key = issued.key
    }
  }

  // Appliance mode: show the hardware/Ollama advisor before wiring.
  if (local) {
    await runDoctor()
    // --daemon registers the gateway as a launchd service (auto-restart on
    // reboot/crash) so the appliance actually survives unattended.
    if (has('--daemon')) installApplianceService()
  }

  // Per-agent wiring output (pure print — never writes agent files).
  if (agents.length > 0) {
    // Canonical OpenAI URL; buildAgentWiring strips /v1 for Claude Code.
    const targets = resolveConnectTargets({ agents, url: `${url}/v1`, key })
    process.stdout.write('\n')
    for (const t of targets) {
      process.stdout.write(`⚓ Wiring ${t.kind}:\n`)
      for (const [k, v] of Object.entries(t.wiring.env)) process.stdout.write(`  ${k}=${v}\n`)
      process.stdout.write(`  ${t.wiring.instructions}\n\n`)
    }
    const warn = keyReuseWarning(agents)
    if (warn) process.stdout.write(warn + '\n')
    return
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
        `  Earnings: ${url}/me?key=${key}\n`,
    )
  } else {
    process.stdout.write(
      `\n✓ Shipyard connected to Claude Code.\n` +
        `  ${path}\n\n` +
        `Your model and inference are UNTOUCHED — Claude Code keeps using your own\n` +
        `Anthropic key. A sponsored line now shows in Claude's spinner during waits,\n` +
        `plus a live-earnings status bar; your wait-time can earn kickbacks.${walletTip}\n` +
        `  Want cheaper inference too? Re-run with --route to route through Shipyard.\n` +
        `  Earnings: ${url}/me?key=${key}\n`,
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
  // Report the impression in the SAME awaited batch as the earnings fetch — the
  // ad is shown in this render, so the requester earns WITHOUT routing inference.
  // It MUST be awaited (concurrently, so no added latency): a fire-and-forget
  // fetch gets killed when this short-lived CLI process exits, so it never sends.
  // Server rate-limits + caps it.
  const [e, lines] = await Promise.all([
    fetchEarnings(url, key),
    fetchPlacementLines(url).catch(() => []),
    fetch(url.replace(/\/+$/, '') + '/api/tender/impression', { method: 'POST', headers: { authorization: `Bearer ${key}` } }).catch(() => null),
  ])
  const line = formatStatusLine(e)
  // Refresh the spinner ad (shown DURING the next wait) from the live auction.
  // Surgical write — only spinnerVerbs, never env.
  try {
    const sp = claudeSettingsPath()
    writeFileSync(sp, JSON.stringify(applyShipyardSpinner(readSettings(sp), spinnerTips(e, lines)), null, 2) + '\n')
  } catch {
    /* best effort */
  }
  writeCache(line)
  process.stdout.write(line)
}

async function main(): Promise<void> {
  const cmd = process.argv[2]
  if (cmd === 'connect') return connect()
  if (cmd === 'doctor') {
    await runDoctor()
    return
  }
  if (cmd === 'statusline') return statusline()
  process.stderr.write(
    'Shipyard Inference — earn on your agent idle-time; optionally route for cheaper inference.\n\n' +
      'Usage:\n' +
      '  npx shipyard-inference connect [--url <gateway>] [--wallet <addr>] [--wallet-key <b58-secret>] [--key <sk-…>] [--route] [--no-statusline] [--local] [--daemon] [--with-ollama]\n' +
            '      Connect Claude Code to Shipyard. By default this adds a live-earnings\n' +
            '      status line and does NOT change your model. Pass --route to also route\n' +
            '      inference through Shipyard for cost savings (sets ANTHROPIC_BASE_URL).\n' +
            '      --wallet-key <b58-secret> mints a wallet-bound key via signature-is-auth\n' +
            '      (no self-serve gate); --local targets the local gateway (127.0.0.1:8787);\n' +
            '      --daemon also installs it as a launchd service; --with-ollama adds ollama.\n' +
      '  npx shipyard-inference doctor\n' +
      '      Probe hardware + Ollama and print your local model ladder and agent env.\n' +
      '  npx shipyard-inference statusline\n' +
      '      Print the live-earnings status line (used by Claude Code).\n',
  )
  process.exit(cmd ? 1 : 0)
}

main().catch((err) => {
  process.stderr.write(`shipyard connect failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
