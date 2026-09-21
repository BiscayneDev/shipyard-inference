# Draft — intro email to Hopscotch Labs

> DRAFT for Halsey to review/send. Tone: peer-to-peer, short, lead with the demo not the deck. Do not send without personalizing names (check LinkedIn / the blog post "why we built Hopscotch" for founder names).

**Subject:** Your 150 models, our local edge — worth a call?

---

Hi [founder names],

Congratulations on the raise — we've followed Hopscotch since the Uniblock days, and what you've built reads like the checklist we wrote for ourselves: one base URL, classified failover, no token markup, spend ceilings that refuse pre-flight. Great minds, apparently.

We're building Shipyard Inference, and we think we're complementary rather than competitors — in fact we'd like to be your local edge:

- **Your breadth + our ladder.** We spiked pointing our router at your base URL (`https://hopscotchlabs.ai/v1` as a plain OpenAI-compatible provider) and it just works — your 150-model catalog becomes one rung in our failover ladder. One integration, both catalogs.
- **We do what you can't: run on the user's machine.** Our appliance gateway colocates with Ollama on the user's Mac — $0 local traffic, hardware-aware model ladder, cloud burst only when the prompt actually needs it. Your hosted catalog is the natural upstream for everything local can't serve.
- **x402 pay-per-call.** We settled metered inference on-chain (Solana USDC, `upto` semantics — 402 challenge, tokens metered, actual settled, remainder refunded). No prepaid balance, no auto-reload. If agents are your customer, wallet-native billing removes their biggest objection.

The ask: 30 minutes. We'll run the live stack — local gateway on a laptop, a request that routes local first, fails over through your-style cloud candidates, and settles per-token on-chain — and talk about whether the provider-rung integration makes sense in both directions.

Either way, genuinely happy for you folks.

[Name]
Shipyard — shipyardOS / Inference
[demo link if available]

---

**Attachments/demo prep checklist:**
- [ ] Live gateway: `node dist/gateway/bin.js --config local.gateway.config.mjs` (port 8787)
- [ ] Cloudflared tunnel for the public URL
- [ ] Surfnet-funded wallet for the x402 demo (`scripts/surfnet-fund.mts`)
- [ ] Hopscotch rung live in the ladder — needs `HOPSCOTCH_KEY` from them (ask for one in the email)
- [ ] `/catalog` page as the "this is what an operator sees" moment (hardware-fit column is the differentiator)
