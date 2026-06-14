import { NoCapableModelError } from '../router/errors.js'
import { SpendCapError, PaymentError } from '../payment/types.js'
import type { AnthropicErrorBody } from './types.js'

/**
 * Map any error thrown below the gateway to an HTTP status + an Anthropic-shaped
 * error body, so Anthropic-compatible clients (Claude Code) see a familiar shape.
 */
export function toAnthropicError(err: unknown): { status: number; body: AnthropicErrorBody } {
  const message = err instanceof Error ? err.message : String(err)

  let status = 500
  let type = 'api_error'

  if (err instanceof NoCapableModelError) {
    status = 400
    type = 'invalid_request_error'
  } else if (err instanceof SpendCapError) {
    status = 402
    type = 'billing_error'
  } else if (err instanceof PaymentError) {
    status = 402
    type = 'billing_error'
  } else {
    const upstream = (err as { status?: unknown }).status
    if (typeof upstream === 'number') {
      status = upstream === 429 ? 429 : upstream >= 500 ? 502 : upstream
      if (status === 401) type = 'authentication_error'
      else if (status === 429) type = 'rate_limit_error'
      else if (status >= 400 && status < 500) type = 'invalid_request_error'
      else if (status >= 500) type = 'api_error'
    }
  }

  return { status, body: { type: 'error', error: { type, message } } }
}
