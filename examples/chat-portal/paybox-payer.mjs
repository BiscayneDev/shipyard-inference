/**
 * Server-side x402 `upto` payer over a connected Paybox wallet.
 *
 * The user connects Paybox via OAuth (paybox-connect.mjs); their wallet signs
 * through Paybox MPC within their grant (passkey-gated, private key never
 * leaves MoonX). This module wraps that signer into the kit TransactionSigner
 * shape the upto client needs, builds the channel-open payment, and hands the
 * portal a verified `UptoVerified` to settle against — the server-side twin
 * of the browser payer in public/src/upto.js.
 */
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { UptoSvmScheme } from '@x402/svm/upto/client'
import { VersionedTransaction } from '@solana/web3.js'
import { payboxSigner } from 'shipyard-inference'

/**
 * Build + sign an upto payment from the user's Paybox wallet and verify it
 * against the portal's own gate. Returns the X402Upto-verified open (escrow
 * already broadcast on-chain).
 */
export async function payWithPaybox({ oauth, upto, ceiling, rpcUrl }) {
  const { PayboxClient } = await import('@paybox-sh/sdk')
  let tokens = oauth
  const expiringSoon = tokens.expiresAt !== undefined && tokens.expiresAt - Date.now() < 5 * 60_000
  if (tokens.refreshToken && expiringSoon) {
    try {
      const { refreshOauth } = await import('./paybox-connect.mjs')
      tokens = await refreshOauth(tokens)
      oauth.onRefresh?.(tokens)
    } catch {
      // A dead token surfaces as a 401 on the request itself.
    }
  }
  const client = new PayboxClient({
    baseUrl: process.env.PAYBOX_BASE_URL ?? 'https://api.paybox.sh',
    token: tokens.accessToken,
    ...(process.env.PAYBOX_SIGNING_KEY ? { signingKey: process.env.PAYBOX_SIGNING_KEY } : {}),
  })

  // Pick the user's Solana wallet credential (first wallet-kind credential).
  const credentials = await client.listCredentials()
  const list = Array.isArray(credentials) ? credentials : credentials?.credentials ?? []
  const wallet = list.find((c) => (c.type ?? c.kind ?? '').toLowerCase().includes('wallet'))
  if (!wallet) throw new Error('no wallet credential in this Paybox account')
  const credentialId = wallet.id ?? wallet.credentialId

  const pb = await payboxSigner({ client, credentialId })

  // kit TransactionPartialSigner over Paybox MPC: envelope the compiled
  // message, MPC-sign it, extract the signature for the payer.
  const kitSigner = {
    address: pb.publicKey,
    async signTransactions(transactions) {
      const dictionaries = []
      for (const tx of transactions) {
        const messageBytes = new Uint8Array(tx.messageBytes)
        const numSigs = (messageBytes[0] & 0x80) !== 0 ? messageBytes[1] : messageBytes[0]
        const envelope = new Uint8Array(1 + numSigs * 64 + messageBytes.length)
        envelope[0] = numSigs
        envelope.set(messageBytes, 1 + numSigs * 64)
        const signedBytes = await pb.signTransaction(envelope)
        const signed = VersionedTransaction.deserialize(signedBytes)
        const idx = signed.message.staticAccountKeys.findIndex((k) => k.toString() === pb.publicKey)
        if (idx === -1) throw new Error('payer not found in Paybox-signed transaction')
        dictionaries.push({ [pb.publicKey]: new Uint8Array(signed.signatures[idx]) })
      }
      return dictionaries
    },
  }

  const xc = new x402Client()
  xc.setSpendControls({ allowedAssets: true })
  xc.register('solana:*', new UptoSvmScheme(kitSigner, { rpcUrl }))
  const http = new x402HTTPClient(xc)

  // Build the payment against the portal's own fresh challenge.
  const requirements = await upto.accepts(ceiling)
  const payload = await http.createPaymentPayload({
    accepts: requirements,
    x402Version: 2,
  })
  const payHeaders = http.encodePaymentSignatureHeader(payload)

  // Verify through the same gate a keyless request would hit — this also
  // broadcasts the channel open (escrowing the ceiling).
  const request = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'x-payment': Object.values(payHeaders)[0] },
  })
  return await upto.verifyOpen(request, ceiling)
}
