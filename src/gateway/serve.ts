import { serve } from '@hono/node-server'
import { createGatewayApp } from './server.js'
import type { GatewayConfig } from './config.js'

export interface RunningGateway {
  port: number
  close(): Promise<void>
}

/** Build the gateway app and bind it to a port via the Node server adapter. */
export function startGateway(config: GatewayConfig): RunningGateway {
  // Fail fast on nonsensical spend-cap config rather than silently blocking
  // all traffic (ceiling 0 would block every keyed request) or allowing
  // negative ceilings / zero-length windows.
  const projectCap = config.spend?.project
  if (projectCap) {
    if (!(projectCap.ceilingUsd > 0)) {
      throw new Error(`invalid gateway config: spend.project.ceilingUsd must be > 0 (got ${projectCap.ceilingUsd})`)
    }
    if (!(projectCap.windowMs > 0)) {
      throw new Error(`invalid gateway config: spend.project.windowMs must be > 0 (got ${projectCap.windowMs})`)
    }
  }
  const app = createGatewayApp(config)
  const port = config.port ?? 8787
  const server = serve({ fetch: app.fetch, port })
  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => (err ? reject(err) : resolve()))
      }),
  }
}
