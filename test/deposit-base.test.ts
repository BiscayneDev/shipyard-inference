import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  baseDepositConfig,
  buildBaseDepositIntent,
  verifyBaseDeposit,
  type BaseDepositConfig,
} from '../src/index.js'

const TREASURY = '0x' + 'aa'.repeat(20) // 0xaaaa...aa
const USDC_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const cfg: BaseDepositConfig = { treasury: TREASURY, network: 'sepolia' }

const addrTopic = (addr: string) => '0x' + '0'.repeat(24) + addr.replace(/^0x/, '').toLowerCase()
const valueData = (usd: number) => '0x' + Math.round(usd * 1_000_000).toString(16).padStart(64, '0')

// A fake eth_getTransactionReceipt RPC returning the given receipt.
const rpcReturning = (receipt: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: receipt }), { status: 200 })) as unknown as typeof fetch

const transferLog = (to: string, usd: number, token = USDC_SEPOLIA) => ({
  address: token,
  topics: [TRANSFER_TOPIC, addrTopic('0x' + 'bb'.repeat(20)), addrTopic(to)],
  data: valueData(usd),
})

test('baseDepositConfig: reads the Base treasury + network from env', () => {
  assert.equal(baseDepositConfig({}), undefined)
  const c = baseDepositConfig({ TENDER_TREASURY_WALLET_BASE: TREASURY, SHIPYARD_SETTLE_NETWORK: 'mainnet' })
  assert.equal(c?.treasury, TREASURY)
  assert.equal(c?.network, 'mainnet')
  // Defaults to the Base Sepolia testnet when not mainnet.
  assert.equal(baseDepositConfig({ TENDER_TREASURY_WALLET_BASE: TREASURY })?.network, 'sepolia')
})

test('buildBaseDepositIntent: encodes a valid EIP-681 URL (token@chain/transfer, atomic amount)', () => {
  const intent = buildBaseDepositIntent(cfg, { amountUsdc: 5 })
  assert.equal(intent.chainId, 84532) // Base Sepolia
  assert.equal(intent.usdcAddress, USDC_SEPOLIA)
  assert.equal(intent.amountUsdc, 5)
  assert.equal(intent.url, `ethereum:${USDC_SEPOLIA}@84532/transfer?address=${TREASURY}&uint256=5000000`)
  // Mainnet → chain 8453 + mainnet USDC.
  const main = buildBaseDepositIntent({ treasury: TREASURY, network: 'mainnet' }, { amountUsdc: 1 })
  assert.equal(main.chainId, 8453)
  assert.equal(main.usdcAddress, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
})

test('verifyBaseDeposit: confirms a USDC Transfer of >= the amount into the treasury', async () => {
  const fetchImpl = rpcReturning({ status: '0x1', logs: [transferLog(TREASURY, 5)] })
  const res = await verifyBaseDeposit(cfg, { txHash: '0xabc', amountUsdc: 5, fetch: fetchImpl })
  assert.equal(res.paid, true)
  assert.equal(res.signature, '0xabc')
})

test('verifyBaseDeposit: sums multiple qualifying transfers in one tx', async () => {
  const fetchImpl = rpcReturning({ status: '0x1', logs: [transferLog(TREASURY, 3), transferLog(TREASURY, 2)] })
  assert.equal((await verifyBaseDeposit(cfg, { txHash: '0xabc', amountUsdc: 5, fetch: fetchImpl })).paid, true)
})

test('verifyBaseDeposit: rejects reverted, wrong-recipient, wrong-token, short, and unmined txs', async () => {
  // Reverted.
  assert.equal((await verifyBaseDeposit(cfg, { txHash: '0x1', amountUsdc: 5, fetch: rpcReturning({ status: '0x0', logs: [transferLog(TREASURY, 5)] }) })).paid, false)
  // Transfer to a different recipient.
  assert.equal((await verifyBaseDeposit(cfg, { txHash: '0x2', amountUsdc: 5, fetch: rpcReturning({ status: '0x1', logs: [transferLog('0x' + 'cc'.repeat(20), 5)] }) })).paid, false)
  // Right recipient but a non-USDC token contract.
  assert.equal((await verifyBaseDeposit(cfg, { txHash: '0x3', amountUsdc: 5, fetch: rpcReturning({ status: '0x1', logs: [transferLog(TREASURY, 5, '0x' + 'dd'.repeat(20))] }) })).paid, false)
  // Underfunded.
  assert.equal((await verifyBaseDeposit(cfg, { txHash: '0x4', amountUsdc: 5, fetch: rpcReturning({ status: '0x1', logs: [transferLog(TREASURY, 4)] }) })).paid, false)
  // Not mined yet (null receipt).
  assert.equal((await verifyBaseDeposit(cfg, { txHash: '0x5', amountUsdc: 5, fetch: rpcReturning(null) })).paid, false)
})
