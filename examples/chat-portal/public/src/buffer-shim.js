// esbuild --inject shim: provide Node's Buffer global in the browser bundle.
// @solana/web3.js references Buffer; without this the funding step throws
// "Buffer is not defined". Mirrors the portal's upto-bundle, which bundles the
// `buffer` package.
import { Buffer } from 'buffer'
globalThis.Buffer = globalThis.Buffer || Buffer
