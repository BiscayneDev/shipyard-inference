import { type SolanaSigner, MissingDependencyError } from './types.js'

/**
 * A simple, non-interactive `SolanaSigner` backed by a raw keypair. Intended
 * for servers/scripts and devnet testing. For production prefer `payboxSigner`,
 * which keeps the secret out of your process and gates spends behind passkey
 * approval.
 *
 * Accepts a 64-byte secret as a `Uint8Array`, a `number[]`, or a JSON-array
 * string (the Solana CLI keypair format). base58 secrets must be decoded by the
 * caller first. Falls back to the `SOLANA_PAYER_SECRET` env var.
 *
 * @security Never commit the secret; use a dedicated low-balance hot wallet.
 */
export async function keypairSigner(
  secret?: Uint8Array | number[] | string,
): Promise<SolanaSigner> {
  const raw = secret ?? process.env.SOLANA_PAYER_SECRET
  if (raw == null || raw === '') {
    throw new Error(
      '[shipyard-inference] keypairSigner requires a secret (or SOLANA_PAYER_SECRET)',
    )
  }

  let web3: typeof import('@solana/web3.js')
  try {
    web3 = await import('@solana/web3.js')
  } catch {
    throw new MissingDependencyError('@solana/web3.js', 'keypairSigner')
  }

  const keypair = web3.Keypair.fromSecretKey(toSecretBytes(raw))

  return {
    publicKey: keypair.publicKey.toBase58(),
    async signTransaction(tx: Uint8Array): Promise<Uint8Array> {
      const vtx = web3.VersionedTransaction.deserialize(tx)
      vtx.sign([keypair])
      return vtx.serialize()
    },
  }
}

function toSecretBytes(raw: Uint8Array | number[] | string): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (Array.isArray(raw)) return Uint8Array.from(raw)
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    return Uint8Array.from(JSON.parse(trimmed) as number[])
  }
  throw new Error(
    '[shipyard-inference] keypairSigner secret string must be a JSON byte array; ' +
      'decode base58 secrets before passing them in',
  )
}
