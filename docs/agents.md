# Agents: funding and identifying yourself (no human in the loop)

An agent can go from **zero** — no account, no key, no balance — to making
paid inference calls entirely on its own. Three endpoints:

| Step | Endpoint | Auth |
|---|---|---|
| Mint an API key | `POST /v1/keys/wallet` | an Ed25519 signature over a challenge — the signature IS the auth |
| Top up credit | `POST /v1/topup` | the wallet-issued key (Bearer) + x402 USDC payment |
| Inference | `POST /v1/chat/completions`, `POST /v1/messages` | the key (Bearer); balance is debited as you spend |

Balances live in the same credit ledger the gateway already uses; a top-up is
an accrual into that ledger, keyed to your key's stable identity.

## 1. Mint a key with your wallet

Build a deterministic challenge, sign it with your Solana wallet's Ed25519
key, and POST it. Nonces are one-shot — a signature mints exactly one key.

```bash
NONCE=$(date +%s)
MSG="shipyard-wallet-key-challenge:v1
shipyard-inference
$PUBKEY
$NONCE"
# sign MSG with the wallet's Ed25519 secret (see the TS snippet for details)
curl -s $GATEWAY/v1/keys/wallet -H 'content-type: application/json' \
  -d "{\"pubkey\":\"$PUBKEY\",\"nonce\":\"$NONCE\",\"signature\":\"$SIG\"}"
# → { "key": "sk-shipyard-…", "keyId": "k_…", "wallet": "$PUBKEY" }
```

The key is a normal gateway key; `account.wallet` records your pubkey for
billing and audit.

## 2. Top up with one x402 payment

```bash
curl -i $GATEWAY/v1/topup \
  -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"amountUsd": 5}'
```

You get a standard x402 **402 challenge priced at exactly `amountUsd`**
(`accepts[0].amount` in atomic USDC, `payTo` the treasury). Settle it the same
way as any x402 call — sign a USDC transfer and retry with the `X-PAYMENT`
header (or let `createPayingFetch` do it). Once verified and confirmed
on-chain, the gateway credits your balance and responds:

```json
{ "balanceUsd": 5, "creditedUsd": 5, "wallet": "$PUBKEY" }
```

Limits: `amountUsd` must be between **0.01** and **1000**. Failed on-chain
verification returns another 402 with the error — nothing is credited.

## TS: the whole loop

```ts
import { generateKeyPairSync, sign, createPrivateKey } from 'node:crypto'
import bs58 from 'bs58'
import { keypairSigner, createSolanaPayProvider, createPayingFetch } from 'shipyard-inference/payment'

const GATEWAY = 'http://127.0.0.1:8787'

// Wallet (an agent holds its own key material).
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const pubkey = bs58.encode(Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url'))
const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d!, 'base64url')

// 1. Key issuance — signature over the challenge.
const nonce = `agent-${Date.now()}`
const message = ['shipyard-wallet-key-challenge:v1', 'shipyard-inference', pubkey, nonce].join('\n')
const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed])
const sig = bs58.encode(sign(null, Buffer.from(message), createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })))
const { key } = await fetch(`${GATEWAY}/v1/keys/wallet`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ pubkey, nonce, signature: sig }),
}).then((r) => r.json() as Promise<{ key: string }>)

// 2+3. Top-up — createPayingFetch answers the 402 challenge automatically.
const signer = await keypairSigner(process.env.FUNDER_SECRET_JSON!)
const payingFetch = createPayingFetch({ paymentProvider: await createSolanaPayProvider({ signer, network: 'devnet' }) })
const { balanceUsd } = await payingFetch(`${GATEWAY}/v1/topup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify({ amountUsd: 5 }),
}).then((r) => r.json() as Promise<{ balanceUsd: number }>)

// 4. Inference on the funded key.
const completion = await fetch(`${GATEWAY}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'ship it' }] }),
})
```

## Runnable example

`scripts/agent-selffund.mts` runs the full loop against a local gateway
(wallet → key → USDC top-up → chat completion):

```bash
node --import tsx scripts/agent-selffund.mts
# env: SHIPYARD_GATEWAY_URL (default http://127.0.0.1:8787), SHIPYARD_TOPUP_USD (default 0.05)
# requires scripts/.localnet.json (same file localnet-paid-call uses)
```

## Environments

| | Localnet (dev) | Surfnet / hosted |
|---|---|---|
| Gateway URL | `http://127.0.0.1:8787` | your deployment's URL |
| Network | Solana **devnet** USDC (`SHIPYARD_SETTLE_NETWORK=devnet`) | mainnet USDC |
| x402 config | `SHIPYARD_X402_TREASURY_WALLET` + `SHIPYARD_X402_PRICE_USDC` | same, set by the operator |
| Key store | any `ApiKeyStore` (in-memory fine) | `SupabaseApiKeyStore` |
| Settle RPC | localnet RPC via `scripts/.localnet.json` | `SHIPYARD_SETTLE_RPC_URL` |
| Test funding | devnet airdrop / localnet faucet | real USDC |

Notes for operators and agents:

- `/v1/keys/wallet` is **unauthenticated by design** — verify signatures, not
  origins. It is available only when a key store is configured (otherwise 501).
- `/v1/topup` requires a **wallet-issued** key (`account.wallet` set): the
  balance must bind to a stable identity. Static bearer keys get a 403.
- Keyless requests to `/v1/topup` are 401 — a payment proves control of USDC
  but does not identify which balance to credit.
- Per-call x402 (`pay per request, no key`) and balance credit (top-up, then
  call with the key) coexist: keyed requests skip payment entirely.
