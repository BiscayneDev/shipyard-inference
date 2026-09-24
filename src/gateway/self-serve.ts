/**
 * Self-serve key switch.
 *
 * Anonymous key creation (the /keys first-key button, /connect "Generate key",
 * `npx shipyard-inference connect`, and key holders minting more keys) is
 * CLOSED unless SHIPYARD_SELF_SERVE_KEYS=on. Closed means: no new keys without
 * the operator token. Existing keys keep working, and key holders can still
 * list, rename, and revoke their keys.
 *
 * Reopening later is one env change: SHIPYARD_SELF_SERVE_KEYS=on.
 */
import { checkBearer } from './auth.js'

export const SELF_SERVE_CLOSED_MESSAGE =
  "Shipyard API keys aren't open for self-serve yet. We're opening them to developers soon."

export const SELF_SERVE_CLOSED_BODY = {
  error: SELF_SERVE_CLOSED_MESSAGE,
  code: 'self_serve_closed',
} as const

/** True only when the env explicitly opens self-serve key creation. */
export function selfServeKeysOpen(env: Record<string, string | undefined>): boolean {
  return (env.SHIPYARD_SELF_SERVE_KEYS ?? '').trim().toLowerCase() === 'on'
}

export interface MintCheckInput {
  open: boolean
  operatorTokens: string[]
  authHeader: string | undefined
}

/**
 * Whether this request may create a brand-new key.
 * Open ⇒ anyone. Closed ⇒ only a request carrying a configured operator token.
 * With no operator tokens configured, closed means nobody (never fail open).
 */
export function canMintKey(input: MintCheckInput): boolean {
  if (input.open) return true
  if (input.operatorTokens.length === 0) return false
  return checkBearer(input.operatorTokens, input.authHeader)
}

/**
 * Put a page into its "not open yet" state. Pages mark self-serve controls with
 * class `ss` and the closed-state copy with class `cl`; the closed body class
 * flips which set shows.
 */
export function closedPage(html: string, open: boolean): string {
  if (open) return html
  return html.replace('</style></head><body>', '</style></head><body class="closed">')
}

/** CSS shared by pages that have a self-serve closed state. */
export const SELF_SERVE_CSS =
  '.cl{display:none}body.closed .cl{display:block}body.closed span.cl{display:inline-block}body.closed .ss{display:none!important}'
