import { execSync } from 'node:child_process'

export interface HardwareProfile {
  chip: string
  totalRamGb: number
  platform: string
}

export interface LadderModel {
  /** Ollama model id, e.g. 'llama3.2:3b'. */
  model: string
  parametersB: number
  tier: 'economy' | 'standard'
  contextWindow: number
}

export interface LocalLadder {
  /** Largest parameter class (in billions) this hardware can serve. */
  maxParametersB: number
  models: LadderModel[]
  source: 'probed' | 'fallback'
}

/**
 * Local model catalog keyed by parameter class. Extend as the Ollama
 * catalog grows; ordering is irrelevant — `ladderForHardware` filters.
 */
const CATALOG: LadderModel[] = [
  { model: 'llama3.2:3b', parametersB: 3, tier: 'economy', contextWindow: 128_000 },
  { model: 'qwen2.5:3b-instruct', parametersB: 3, tier: 'economy', contextWindow: 32_000 },
  { model: 'llama3.1:8b', parametersB: 8, tier: 'standard', contextWindow: 128_000 },
  { model: 'qwen2.5:14b-instruct', parametersB: 14, tier: 'standard', contextWindow: 32_000 },
  { model: 'qwen2.5:32b-instruct', parametersB: 32, tier: 'standard', contextWindow: 32_000 },
  { model: 'llama3.3:70b', parametersB: 70, tier: 'standard', contextWindow: 128_000 },
]

const FALLBACK_LADDER: LocalLadder = {
  maxParametersB: 3,
  models: CATALOG.filter((m) => m.parametersB <= 3),
  source: 'fallback',
}

/**
 * Probe the host hardware. Returns null when nothing could be determined
 * (never throws) so callers can fall back to a conservative ladder.
 */
export function probeHardware(
  deps?: { execSync?: (cmd: string) => string; platform?: NodeJS.Platform },
): HardwareProfile | null {
  const run =
    deps?.execSync ??
    ((cmd: string) => execSync(cmd, { encoding: 'utf8' }) as string)
  const platform = deps?.platform ?? process.platform
  try {
    if (platform === 'darwin') {
      const chip = run('sysctl -n machdep.cpu.brand_string').trim()
      const memBytes = Number(run('sysctl -n hw.memsize').trim())
      if (!Number.isFinite(memBytes) || memBytes <= 0 || !chip) return null
      return { chip, totalRamGb: Math.round(memBytes / 1024 ** 3), platform: 'darwin' }
    }
    if (platform === 'linux') {
      const memKb = Number(run("awk '/MemTotal/{print $2}' /proc/meminfo").trim())
      const chip = run("grep -m1 'model name' /proc/cpuinfo").split(':').pop()!.trim()
      if (!Number.isFinite(memKb) || memKb <= 0) return null
      return { chip, totalRamGb: Math.round(memKb / 1024 ** 2), platform: 'linux' }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Rule of thumb for Apple unified memory: usable VRAM is the lesser of
 * 70% of RAM or RAM minus a ~6GB OS reserve; a Q4-quantized model needs
 * ≈ 0.6GB per parameter-billion. (An 8GB Mac → 3B class only, which
 * matches the real-world reference deployment.)
 */
export function ladderForHardware(hw: HardwareProfile | null): LocalLadder {
  if (!hw) return FALLBACK_LADDER
  const usableGb = Math.min(hw.totalRamGb * 0.7, hw.totalRamGb - 6)
  const maxParametersB = Math.floor(usableGb / 0.6)
  if (maxParametersB < 3) return FALLBACK_LADDER
  return {
    maxParametersB,
    models: CATALOG.filter((m) => m.parametersB <= maxParametersB),
    source: 'probed',
  }
}
