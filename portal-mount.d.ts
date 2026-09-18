// Type declaration for the chat-portal mount — a plain .mjs Hono app that
// tsc can't resolve (JS, outside src/, deliberately unbundled). The portal
// app is imported lazily at runtime so its heavy deps (pay-kit, @paybox-sh)
// stay out of the gateway's cold path.
declare module '*/examples/chat-portal/server.mjs' {
  import type { Hono } from 'hono'
  export const portalApp: Hono
}
