/**
 * Appliance ops — "Survive applied to the box itself."
 *
 * Runs the local shipyard-gateway (and optionally Ollama) as a macOS LaunchAgent
 * so the box auto-recovers: launchd starts the service at login (`RunAtLoad`)
 * and restarts it if it crashes (`KeepAlive`). This is the appliance-mode
 * guarantee that the model layer stays up without a human.
 *
 * Two services, one home (`~/Library/LaunchAgents/`):
 *   - com.shipyard-inference.gateway  → node dist/gateway/bin.js --config <cfg>
 *   - com.shipyard-inference.ollama   → ollama serve   (optional, if present)
 *
 * Plist generation is pure and unit-tested here. The install/uninstall/status
 * actions shell out to `launchctl` (real load/unload/list) — separated so the
 * XML is deterministic and the side effects stay at the edges.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export const GATEWAY_LABEL = 'com.shipyard-inference.gateway'
export const OLLAMA_LABEL = 'com.shipyard-inference.ollama'
export const DEFAULT_PORT = 8787

export interface PlistInput {
  label: string
  /** Absolute path to the node binary (resolved at install time). */
  nodeBin: string
  /** Absolute path to dist/gateway/bin.js. */
  programPath: string
  /** Absolute path to the gateway config module. */
  configPath: string
  port: number
  /** Absolute working directory (repo root) — config relative paths resolve. */
  workingDir: string
  logDir: string
  /** Extra environment pairs to thread in (e.g. x402/x402r env for billing). */
  env?: Record<string, string>
}

const LOG_PATH_MODE = { mode: 0o644 }

/** Sanitize a value into XML-safe plist string content. */
function esc(v: string | number): string {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Build the launchd plist for the gateway, as a string. Pure — no I/O.
 * KeepAlive runs the service at login and restarts it on crash; WorkingDirectory
 * is the repo root so config-relative paths (e.g. `./.env.local`) resolve.
 */
export function gatewayPlist(p: PlistInput): string {
  const envDict = [
    '<key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>',
    ...Object.entries(p.env ?? {}).map(
      ([k, v]) => `<key>${esc(k)}</key><string>${esc(v)}</string>`,
    ),
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${esc(p.label)}</string>
  <key>WorkingDirectory</key><string>${esc(p.workingDir)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(p.nodeBin)}</string>
    <string>${esc(p.programPath)}</string>
    <string>--config</string>
    <string>${esc(p.configPath)}</string>
    <string>--port</string>
    <string>${esc(p.port)}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${esc(resolve(p.logDir, 'gateway.stdout.log'))}</string>
  <key>StandardErrorPath</key><string>${esc(resolve(p.logDir, 'gateway.stderr.log'))}</string>
  <key>EnvironmentVariables</key><dict>${envDict}</dict>
</dict>
</plist>
`
}

/** Build the launchd plist for Ollama (`ollama serve`), pure. Keeps the local models up. */
export function ollamaPlist(opts: { ollamaBin: string; logDir: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${esc(OLLAMA_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(opts.ollamaBin)}</string>
    <string>serve</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${esc(resolve(opts.logDir, 'ollama.stdout.log'))}</string>
  <key>StandardErrorPath</key><string>${esc(resolve(opts.logDir, 'ollama.stderr.log'))}</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>OLLAMA_KEEP_ALIVE</key><string>0</string>
  </dict>
</dict>
</plist>
`
}

export function launchAgentDir(): string {
  return resolve(homedir(), 'Library', 'LaunchAgents')
}
export function plistPath(label: string): string {
  return resolve(launchAgentDir(), `${label}.plist`)
}
export function gatewayLogDir(): string {
  return resolve(homedir(), '.shipyard', 'logs')
}

/** Abort if a required path is missing, with a clear appliance-ops message. */
function requirePath(p: string, what: string, extra?: string): void {
  if (!existsSync(p)) {
    throw new Error(`${what} not found at ${p}${extra ? ` — ${extra}` : ''}`)
  }
}

/**
 * Resolve the ollama binary for the plist. Honors OLLAMA_BIN override, then
 * `which ollama` (the binary it finds on this box), else undefined (= skip).
 * Ollama is optional — absence just means we don't manage its keep-alive.
 */
function resolveOllamaBin(): string | undefined {
  const override = process.env.OLLAMA_BIN
  if (override && existsSync(override)) return resolve(override)
  try {
    const found = execFileSync('which', ['ollama'], { encoding: 'utf8' }).trim()
    return found ? found : undefined
  } catch {
    return undefined
  }
}

export interface InstallOptions {
  nodeBin: string
  programPath: string
  configPath: string
  port?: number
  /** Absolute repo root (determines working dir + relative config resolution). */
  repoDir?: string
  /** Also install an `ollama serve` agent (no-op if the ollama binary is absent). */
  withOllama?: boolean
  /** Extra env pairs for the gateway plist (e.g. x402r env for billing). */
  env?: Record<string, string>
  dryRun?: boolean
}

export interface InstallResult {
  gatewayPlist: string
  gatewayLoaded: boolean
  ollamaPlist?: string
  ollamaLoaded?: boolean
  logDir: string
}

/**
 * Write + load the gateway LaunchAgent (and Ollama if requested and present).
 * `dryRun` writes the plist but skips `launchctl load` (for tests). Returns what
 * was placed so callers (CLI) can print a concise report.
 */
export function installService(opts: InstallOptions): InstallResult {
  const logDir = gatewayLogDir()
  mkdirSync(logDir, { recursive: true })
  const dir = launchAgentDir()
  mkdirSync(dir, { recursive: true })

  requirePath(opts.nodeBin, 'node binary')
  requirePath(opts.programPath, 'gateway binary', 'run `npm run build` first')
  requirePath(opts.configPath, 'gateway config')

  const workingDir = resolve(opts.repoDir ?? process.cwd())
  const plist = gatewayPlist({
    label: GATEWAY_LABEL,
    nodeBin: opts.nodeBin,
    programPath: opts.programPath,
    configPath: opts.configPath,
    port: opts.port ?? DEFAULT_PORT,
    workingDir,
    logDir,
    env: opts.env,
  })
  const gp = plistPath(GATEWAY_LABEL)
  writeFileSync(gp, plist, LOG_PATH_MODE)

  let gatewayLoaded = true
  if (!opts.dryRun) {
    // `unload` first so re-install is idempotent (avoids "already loaded" errors).
    execFileSync('launchctl', ['unload', gp], { stdio: 'ignore' })
    execFileSync('launchctl', ['load', gp])
  }

  const result: InstallResult = { gatewayPlist: gp, gatewayLoaded, logDir }

  if (opts.withOllama) {
    const ollamaBin = resolveOllamaBin()
    if (ollamaBin) {
      const oPlist = ollamaPlist({ ollamaBin, logDir })
      const op = plistPath(OLLAMA_LABEL)
      writeFileSync(op, oPlist, LOG_PATH_MODE)
      let ollamaLoaded = true
      if (!opts.dryRun) {
        execFileSync('launchctl', ['unload', op], { stdio: 'ignore' })
        execFileSync('launchctl', ['load', op])
      }
      result.ollamaPlist = op
      result.ollamaLoaded = ollamaLoaded
    }
  }
  return result
}

/** Remove both LaunchAgents (idempotent — ignores missing). */
export function uninstallService(opts: { dryRun?: boolean } = {}): { removed: string[] } {
  const removed: string[] = []
  for (const label of [GATEWAY_LABEL, OLLAMA_LABEL]) {
    const p = plistPath(label)
    if (!existsSync(p)) continue
    if (!opts.dryRun) {
      try {
        execFileSync('launchctl', ['unload', p], { stdio: 'ignore' })
      } catch {
        /* not loaded — fine */
      }
      rmSync(p, { force: true })
    }
    removed.push(p)
  }
  return { removed }
}

/** Loaded state via `launchctl list`; `true` when present, `false` when absent. */
export function serviceStatus(label: string): { label: string; loaded: boolean; pid?: string } {
  try {
    const raw = execFileSync('launchctl', ['list', label], { encoding: 'utf8' })
    const out = (raw || '').trim()
    // Row shape: `<pid>\t<status>\t<label>`. A running job has a numeric pid;
    // a registered-but-idle job shows `-` or blank in that field.
    const fields = out.split('\t')
    const pid = fields[0]?.match(/^\d+$/)?.[0] ?? undefined
    return { label, loaded: true, pid }
  } catch {
    return { label, loaded: false }
  }
}

/** Confirm the gateway actually answers (nothing more than a health check). */
export function healthCheck(port = DEFAULT_PORT, timeoutMs = 2000): boolean {
  try {
    const out = execFileSync(
      'curl',
      ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', String(timeoutMs / 1000), 'http://127.0.0.1:' + port + '/v1/models'],
      { encoding: 'utf8' },
    )
    return out.trim() === '200' || out.trim() === '401'
  } catch {
    return false
  }
}
