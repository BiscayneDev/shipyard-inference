import type { HardwareProfile, LocalLadder } from './hardware.js'
import type { LocalModelsMatch } from './ollama-probe.js'

export interface AdvisorInput {
  hardware: HardwareProfile | null
  ladder: LocalLadder
  runtime: LocalModelsMatch
}

/**
 * Human-readable appliance advisor: what your hardware can serve, what's
 * pulled, what to pull, and the env to point an agent at. Pure — the CLI
 * owns I/O. The `model: auto` line is Survive-critical: explicit model ids
 * get pinned by the gateway and never fail over.
 */
export function buildAdvisorReport(input: AdvisorInput): string {
  const { hardware, ladder, runtime } = input
  const lines: string[] = []

  lines.push('⚓ Shipyard appliance advisor')
  lines.push('')
  if (hardware) {
    lines.push(`Hardware: ${hardware.chip} · ${hardware.totalRamGb} GB (${hardware.platform})`)
    lines.push(`Local ladder: up to ${ladder.maxParametersB}B-parameter models (${ladder.source})`)
  } else {
    lines.push('Hardware: unknown — using the conservative fallback ladder (3B class).')
  }
  lines.push('')

  if (!runtime.ollamaUp) {
    lines.push('⚠️  Ollama is not running. Start it with:')
    lines.push('   ollama serve')
    lines.push('')
  }

  if (runtime.available.length > 0) {
    lines.push('Ready to serve locally (free):')
    for (const m of runtime.available) {
      lines.push(`  ✓ ${m.model} (${m.tier}, ${m.contextWindow.toLocaleString('en-US')} ctx)`)
    }
    lines.push('')
  }
  if (runtime.missing.length > 0) {
    lines.push('Your hardware can serve these but they are not pulled:')
    for (const m of runtime.missing) lines.push(`  • ollama pull ${m.model}`)
    lines.push('')
  }

  lines.push('Point your agent at the gateway with:')
  lines.push('  SHIPYARD_INFERENCE_URL=http://127.0.0.1:8787/v1')
  lines.push('  SHIPYARD_INFERENCE_API_KEY=<your key>')
  lines.push(
    '  model: auto   ← REQUIRED: explicit model ids get pinned and never fail over',
  )
  return lines.join('\n')
}
