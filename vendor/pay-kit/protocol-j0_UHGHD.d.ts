/** Payment protocols a PayKit server can accept. */
type Protocol = 'mpp' | 'x402';
/**
 * Canonical PayKit network names, shared across the cross-language SDK family.
 */
type Network = 'solana_devnet' | 'solana_localnet' | 'solana_mainnet';
/** Solana-style network slugs, accepted anywhere a {@link Network} is. */
type NetworkSlug = 'devnet' | 'localnet' | 'mainnet-beta' | 'mainnet';
/** Normalizes a canonical network name or Solana slug to the canonical name. */
declare function toNetwork(value: Network | NetworkSlug): Network;
/**
 * Maps a PayKit network name to the Solana network slug used by
 * `@solana/mpp` (`mainnet` / `devnet` / `localnet`).
 */
declare function toSolanaNetwork(network: Network): 'devnet' | 'localnet' | 'mainnet';
/**
 * CAIP-2 chain identifier advertised in `accepts[]` entries.
 *
 * Surfpool-localnet clones mainnet state *including its genesis hash*
 * (`getGenesisHash` returns the mainnet hash `5eykt4…`), so it advertises the
 * mainnet CAIP-2 — that's what a CAIP-2-validating client sees on-chain.
 * Only `devnet` uses the devnet genesis.
 */
declare function caip2(network: Network): string;

export { type Network as N, type Protocol as P, type NetworkSlug as a, toSolanaNetwork as b, caip2 as c, toNetwork as t };
