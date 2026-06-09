import { serve } from '@hono/node-server'
import { createGatewayApp } from './server.js'
import type { GatewayConfig } from './config.js'

export interface RunningGateway {
  port: number
  close(): Promise<void>
}

/** Build the gateway app and bind it to a port via the Node server adapter. */
export function startGateway(config: GatewayConfig): RunningGateway {
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
