// Browser wallet helpers for the chat portal — Phantom (or any injected Solana
// wallet) connect + signing. Bundled with @solana/web3.js via esbuild into
// ../wallet-bundle.js, then exposed on window for the zero-build app.js:
//
//   npx esbuild examples/chat-portal/public/src/wallet.js \
//     --bundle --format=iife --outfile=examples/chat-portal/public/wallet-bundle.js
//
// The server builds the (unsigned) UsePod-deposit transaction; this signs it with
// the user's own non-custodial wallet in the browser; the server submits it. The
// private key never leaves the wallet.
import { Transaction } from '@solana/web3.js'

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

async function connectPhantom() {
  const p = provider()
  if (!p) throw new Error('Phantom not detected — install the Phantom wallet extension.')
  const res = await p.connect()
  return res.publicKey.toString()
}

// Sign a server-built base64 (unsigned, legacy) transaction; return signed base64.
async function signTransactionBase64(transactionBase64) {
  const p = provider()
  if (!p) throw new Error('Phantom not detected.')
  const tx = Transaction.from(b64ToU8(transactionBase64))
  const signed = await p.signTransaction(tx)
  return u8ToB64(signed.serialize())
}

window.ShipyardWallet = {
  hasPhantom: () => !!provider(),
  connectPhantom,
  signTransactionBase64,
}
