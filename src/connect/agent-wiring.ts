export type AgentKind = 'claude' | 'openclaw' | 'env'

export interface AgentWiring {
  env: Record<string, string>
  instructions: string
}

/**
 * The exact wiring for one agent kind. Every path enforces model:auto
 * (pinned models never fail over) and a per-agent key (the spend breaker
 * keys on the API key — one drained agent must not starve the others).
 * Claude's env is advisory here: `connect --route` (bin.ts) owns the actual
 * settings.json takeover with backup.
 */
export function buildAgentWiring(
  kind: AgentKind,
  opts: { url: string; key: string },
): AgentWiring {
  const { url, key } = opts
  if (kind === 'claude') {
    return {
      env: {
        ANTHROPIC_BASE_URL: url.replace(/\/v1$/, ''), // Claude Code appends /v1
        ANTHROPIC_AUTH_TOKEN: key,
      },
      instructions:
        'Run `shipyard-inference connect --route --url <gateway> --key <key>` — it backs up and ' +
        'rewrites ~/.claude/settings.json for you. Restore the backup after testing.',
    }
  }
  if (kind === 'openclaw') {
    return {
      env: {
        SHIPYARD_INFERENCE_URL: url,
        SHIPYARD_INFERENCE_API_KEY: key,
        AGENT_MODEL_VIC: 'auto',
      },
      instructions:
        'Append these to the OpenClaw project .env.local (its OWN env — never share keys ' +
        'across projects) and restart the agent. Requests must use model `auto` so the ' +
        'gateway can fail over; any other value gets pinned to one candidate.',
    }
  }
  return {
    env: {
      OPENAI_BASE_URL: url,
      OPENAI_API_KEY: key,
    },
    instructions:
      'Export these in the agent process (OpenAI-compatible). Request model `auto` — ' +
      'explicit model ids get pinned by the gateway and never fail over.',
  }
}

export interface ConnectTarget {
  kind: AgentKind
  wiring: AgentWiring
}

/** Expand the requested agent kinds into their wirings, in request order. */
export function resolveConnectTargets(opts: {
  agents: AgentKind[]
  url: string
  key: string
}): ConnectTarget[] {
  return opts.agents.map((kind) => ({
    kind,
    wiring: buildAgentWiring(kind, { url: opts.url, key: opts.key }),
  }))
}

/** Multiple agents sharing one key share one spend ceiling — warn. */
export function keyReuseWarning(kinds: AgentKind[]): string | null {
  if (kinds.length <= 1) return null
  return (
    '⚠️  These agents share ONE key, so they share ONE spend ceiling. Issue a ' +
    'separate key per agent (shipyard-inference connect --key <sk-…> per agent) ' +
    'so a drained agent cannot starve the others.'
  )
}
