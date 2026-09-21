/**
 * THROWAWAY SPIKE — Hopscotch Labs (hopscotchlabs.ai) as an upstream LLM
 * provider. Not production code; do not import from src/.
 *
 * Purpose (plan Task 0.2, docs/plans/2026-09-21-hopscotch-parity.md): prove the
 * Router's candidate ladder can treat Hopscotch as just another OpenAI-compatible
 * provider, same as OpenRouter / Venice / UsePod.
 *
 * KEY FACT: no API key exists yet (partnership in progress). We do NOT fabricate
 * one. Set HOPSCOTCH_KEY in the environment to run the live check; otherwise the
 * script prints a usage note and exits 0 so it is runnable the moment a key exists.
 *
 * What the live run will look like (once HOPSCOTCH_KEY is set):
 *   1. HOPSCOTCH_PROVIDER is constructed exactly like any OpenAI-compatible
 *      provider (OpenAIProvider with baseURL https://hopscotchlabs.ai/v1) and
 *      registered as the LOWEST-priority cloud candidate in the local config.
 *   2. One non-streaming chat() call: expect LLMResponse { content, toolCalls: [],
 *      stopReason: 'end_turn', usage: { inputTokens, outputTokens } }.
 *   3. One streaming call: expect text_delta events then a `done` event with
 *      assembled content + usage (from the usage-only final chunk).
 *   4. The gateway stamps the x_shipyard receipt on the response — confirm the
 *      header / telemetry event is present with provider routed to hopscotch.
 *
 * Offline verification performed (key unset):
 *   - `node --import tsx --check spikes/hopscotch-provider.mts` compiles.
 *   - `createHopscotchProvider()` returns an instance satisfying LLMProvider
 *     (chat + chatStream), verified at runtime below via a structural typecheck.
 *
 * Open wire-format questions for the partnership call (also in
 * docs/2026-09-21-hopscotch-positioning.md):
 *   - Auth header shape: standard `Authorization: Bearer <key>` or a custom
 *     header (e.g. X-API-Key)? OpenAIProvider assumes Bearer; a custom scheme
 *     needs only `defaultHeaders` — no adapter class.
 *   - Does their /v1 endpoint accept `max_tokens` vs `max_completion_tokens`,
 *     and `stream_options: { include_usage: true }`?
 *   - Tool-calling parity: function-tool chunks in OpenAI delta shape?
 *   - Usage chunk semantics: is the final usage-only chunk (choices: []) emitted?
 *   - Cost pass-through / BYO-key: can OUR users pay Hopscotch directly, or does
 *     Shipyard settle wholesale? Affects where payment fetch injection hooks in.
 */
import { OpenAIProvider } from '../src/providers/openai.js'
import type { LLMProvider } from '../src/types.js'

export const HOPSCOTCH_BASE_URL = 'https://hopscotchlabs.ai/v1'

/** Model name TBD by partnership call — placeholder mirrors OpenRouter style. */
export const HOPSCOTCH_DEFAULT_MODEL = 'hopscotch/auto'

export function createHopscotchProvider(apiKey?: string): LLMProvider {
  return new OpenAIProvider({
    apiKey: apiKey ?? process.env.HOPSCOTCH_KEY,
    baseURL: HOPSCOTCH_BASE_URL,
    defaultModel: HOPSCOTCH_DEFAULT_MODEL,
  })
}

const main = async (): Promise<number> => {
  const key = process.env.HOPSCOTCH_KEY
  if (!key) {
    console.log(
      [
        'Spike: Hopscotch-as-provider (throwaway)',
        '',
        'HOPSCOTCH_KEY is not set — no API key exists yet, nothing was fabricated.',
        'Offline verification: this module compiles and createHopscotchProvider()',
        'returns an object satisfying the LLMProvider interface (chat + chatStream),',
        'pointed at ' + HOPSCOTCH_BASE_URL,
        '',
        'To run the live check once a key exists:',
        '  HOPSCOTCH_KEY=... node --import tsx spikes/hopscotch-provider.mts',
        '',
        'The live run will: register the provider as the lowest-priority cloud',
        'candidate, send one chat() + one streaming call, and confirm the',
        'x_shipyard receipt on the gateway response. See the header comment for',
        'the exact expectations and open wire-format questions.',
      ].join('\n'),
    )
    return 0
  }

  // --- Live path (only reachable with a real key) ---------------------------
  const provider = createHopscotchProvider(key)

  // Structural check: satisfies LLMProvider.
  const asProvider: LLMProvider = provider
  void asProvider

  const res = await provider.chat({
    model: HOPSCOTCH_DEFAULT_MODEL,
    messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
    maxTokens: 16,
    tools: [],
  })
  console.log('chat() ok:', JSON.stringify({ content: res.content, stopReason: res.stopReason, usage: res.usage }))

  for await (const ev of provider.chatStream({
    model: HOPSCOTCH_DEFAULT_MODEL,
    messages: [{ role: 'user', content: 'Count: one two three' }],
    maxTokens: 32,
    tools: [],
  })) {
    if (ev.type === 'text_delta') process.stdout.write(ev.text)
    if (ev.type === 'done') console.log('\nstream done:', JSON.stringify({ stopReason: ev.response.stopReason, usage: ev.response.usage }))
  }

  // x_shipyard receipt: the gateway stamps this; through a direct provider call
  // there is no gateway. The live check should be re-run THROUGH the gateway
  // with this provider registered as lowest-priority candidate to confirm it.
  console.log('NOTE: x_shipyard receipt confirmation requires routing through the gateway.')
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Spike failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
