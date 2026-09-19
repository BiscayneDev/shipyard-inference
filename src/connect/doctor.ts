import { probeHardware, ladderForHardware } from './hardware.js'
import { matchLocalModels } from './ollama-probe.js'
import { buildAdvisorReport } from './advisor.js'

export interface DoctorOptions {
  write?: (s: string) => void
  baseUrl?: string
  fetchImpl?: typeof fetch
  execSync?: (cmd: string) => string
}

/**
 * Compose the live probes (hardware, Ollama) into the advisor report and
 * print it. Never throws — every probe degrades gracefully.
 */
export async function runDoctor(opts: DoctorOptions = {}): Promise<string> {
  const write = opts.write ?? ((s: string) => process.stdout.write(s))
  const hardware = probeHardware(opts.execSync ? { execSync: opts.execSync } : undefined)
  const ladder = ladderForHardware(hardware)
  const runtime = await matchLocalModels({
    baseUrl:
      opts.baseUrl ??
      process.env.OLLAMA_BASE_URL?.replace(/\/v1$/, '') ??
      'http://127.0.0.1:11434',
    ladder,
    fetchImpl: opts.fetchImpl,
  })
  const report = buildAdvisorReport({ hardware, ladder, runtime })
  write(report + '\n')
  return report
}
