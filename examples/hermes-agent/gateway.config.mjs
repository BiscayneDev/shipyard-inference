// Sample config for the shipyard-inference OpenAI-compatible gateway.
//
//   npx shipyard-gateway --config ./examples/hermes-agent/gateway.config.mjs
//
// It cost-routes across Anthropic and Nous/Hermes; point any OpenAI-compatible
// client (including Hermes Agent — see README.md) at http://localhost:8787/v1.
import {
  AnthropicProvider,
  createNousProvider,
  costOptimized,
} from 'shipyard-inference'

/** @type {import('shipyard-inference/gateway').GatewayConfig} */
export default {
  port: 8787,
  apiKeys: [process.env.SHIPYARD_GATEWAY_KEY ?? 'dev-key'],
  strategy: costOptimized(),
  candidates: [
    {
      id: 'anthropic',
      provider: new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }),
      models: [
        { model: 'claude-haiku-4-5', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200000, tier: 'economy', capabilities: ['tools'] },
        { model: 'claude-sonnet-4-5', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200000, tier: 'standard', capabilities: ['tools'] },
      ],
    },
    {
      id: 'nous',
      provider: createNousProvider({ apiKey: process.env.NOUS_API_KEY }),
      models: [
        { model: 'Hermes-4-405B', inputCostPerMTok: 0.9, outputCostPerMTok: 0.9, contextWindow: 128000, tier: 'standard', capabilities: ['tools'] },
      ],
    },
  ],
}
