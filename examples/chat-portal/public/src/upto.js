// Browser x402 `upto` payer for the chat portal — Phantom (or any injected
// Solana wallet) signs the payment-channel open in-browser. The private key
// never leaves the wallet; the server never sees key material. This is the
// "only a wallet" path: no account, no API key, no server-side payer.
//
// Bundled with esbuild into ../upto-bundle.js alongside wallet-bundle.js:
//   npx esbuild public/src/upto.js --bundle --format=iife \
//     --outfile=public/upto-bundle.js --platform=browser
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { UptoSvmScheme } from '@x402/svm/upto/client'
import { VersionedTransaction } from '@solana/web3.js'

const provider = () => window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null)

const u8ToB64 = (u8) => {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}
const b64ToU8 = (b64) => {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

/**
 * kit TransactionPartialSigner over Phantom: signTransactions receives wire
 * transactions ({ messageBytes }) and must return signature dictionaries
 * keyed by signer address. Phantom signs the underlying versioned message
 * through its own prompt — the user approves, the key never leaves the wallet.
 */
let lastWalletTx = null // the wallet's own returned transaction (message may differ from what we sent — e.g. added priority-fee instructions)

function phantomSigner(address) {
  return {
    address,
    async signTransactions(transactions) {
      const p = provider()
      if (!p) throw new Error('Phantom not detected.')
      const dictionaries = []
      for (const tx of transactions) {
        // kit hands us the compiled message as raw bytes (ReadonlyUint8Array),
        // and expects raw 64-byte signature bytes back, keyed by address.
        const messageBytes = new Uint8Array(tx.messageBytes)
        // Sign the MESSAGE BYTES directly via signMessage — wallets can (and
        // do) mutate transactions handed to signTransaction (adding priority
        // fees or assertion instructions like Lighthouse), which invalidates
        // the signature over the original message. Raw message signing leaves
        // nothing to mutate: the wallet signs exactly these bytes.
        const p = provider()
        let signatureBytes
        if (typeof p.signTransaction === 'function') {
          // Transaction signing: the wallet may mutate the message (priority
          // fees, Lighthouse assertions) — handled by overriding the payload's
          // openTransaction with the wallet's own returned transaction.
          const numSigs = (messageBytes[0] & 0x80) !== 0 ? messageBytes[1] : messageBytes[0]
          const envelope = new Uint8Array(1 + numSigs * 64 + messageBytes.length)
          envelope[0] = numSigs
          envelope.set(messageBytes, 1 + numSigs * 64)
          const vtx = VersionedTransaction.deserialize(envelope)
          const phantomResult = await p.signTransaction(vtx)
          const signed =
            phantomResult instanceof VersionedTransaction
              ? phantomResult
              : VersionedTransaction.deserialize(phantomResult.serialize())
          lastWalletTx = signed
          try {
            await fetch('api/upto-debug', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ from: address, sent: u8ToB64(vtx.serialize()), received: u8ToB64(signed.serialize()) }),
            })
          } catch { /* non-fatal */ }
          const idx = signed.message.staticAccountKeys.findIndex((k) => k.toString() === address)
          if (idx === -1) throw new Error('payer not found in transaction signers')
          signatureBytes = new Uint8Array(signed.signatures[idx])
        } else if (typeof p.signMessage === 'function') {
          // Fallback — raw message signing (some wallets block this for
          // transaction-shaped bytes; leaves nothing to mutate).
          const { signature } = await p.signMessage(messageBytes, 'utf8')
          signatureBytes = new Uint8Array(signature)
          lastWalletTx = null
        } else {
          throw new Error('Wallet supports neither signTransaction nor signMessage.')
        }
        dictionaries.push({ [address]: signatureBytes })
      }
      return dictionaries
    },
  }
}

/** Resolve the payer address, connecting the wallet if needed. */
async function payerAddress() {
  const p = provider()
  if (!p) throw new Error('Phantom not detected — install the Phantom wallet extension.')
  if (!p.publicKey) await p.connect()
  return p.publicKey.toString()
}

/**
 * One wallet-paid request: fetch; on 402, connect the wallet, build + sign the
 * channel open, retry with the payment header. Returns the paid Response.
 */
async function payAndRetry(url, init = {}, rpcUrl) {
  const address = await payerAddress()
  const client = new x402Client()
  // Local/dev stand-in mints aren't in the default asset table — allow any
  // asset (the challenge itself names the mint; the user sees it in Phantom).
  client.setSpendControls({ allowedAssets: true })
  client.register('solana:*', new UptoSvmScheme(phantomSigner(address), { rpcUrl }))
  const http = new x402HTTPClient(client)

  const probe = await fetch(url, init)
  if (probe.status !== 402) return probe

  const required = http.getPaymentRequiredResponse((name) => probe.headers.get(name))
  const payload = await http.createPaymentPayload(required)
  // Wallets may normalize/mutate the message before signing (e.g. Phantom adds
  // priority-fee instructions), which invalidates the signature over the
  // original message. The wallet's own returned transaction carries a valid
  // signature over ITS message — use that as the open transaction. The channel
  // PDA derives from seeds (payer/payee/mint/signer/salt/openSlot), not from
  // the message bytes, so every other payload field stays consistent.
  if (lastWalletTx) {
    payload.payload.openTransaction = u8ToB64(lastWalletTx.serialize())
  }
  const payHeaders = http.encodePaymentSignatureHeader(payload)
  const headers = { ...(init.headers ?? {}) }
  for (const [name, value] of Object.entries(payHeaders)) headers[name] = value
  return await fetch(url, { ...init, headers })
}

window.ShipyardUpto = {
  hasPhantom: () => !!provider(),
  payAndRetry,
}
