import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baseSettle, isEvmAddress, type EvmSender } from '../src/payment/index.js'

const captureSender = () => {
  const calls: Array<{ usdc: string; to: string; amountAtomic: bigint }> = []
  const sender: EvmSender = {
    async sendUsdcTransfer(args) {
      calls.push(args)
      return { hash: `0xhash_${args.to}` }
    },
  }
  return { sender, calls }
}

const EVM = '0x1111111111111111111111111111111111111111'

test('isEvmAddress: matches 0x + 40 hex, rejects Solana base58 and junk', () => {
  assert.equal(isEvmAddress(EVM), true)
  assert.equal(isEvmAddress('  0xAbC0000000000000000000000000000000000001 '), true) // trimmed, mixed case
  assert.equal(isEvmAddress('0x123'), false) // too short
  assert.equal(isEvmAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), false) // Solana
  assert.equal(isEvmAddress('0xZZZ1111111111111111111111111111111111111'), false) // non-hex
})

test('baseSettle: transfers atomic USDC via the injected sender and returns the tx hash', async () => {
  const { sender, calls } = captureSender()
  const res = await baseSettle({ to: EVM, amount: '1500000', network: 'sepolia', sender })
  assert.equal(res.signature, `0xhash_${EVM}`)
  assert.equal(res.amount, '1500000')
  assert.equal(res.to, EVM)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].amountAtomic, 1500000n)
  // Sepolia USDC contract.
  assert.equal(calls[0].usdc, '0x036CbD53842c5426634e7929541eC2318f3dCF7e')
})

test('baseSettle: picks the mainnet USDC contract on mainnet; honors an override', async () => {
  const main = captureSender()
  await baseSettle({ to: EVM, amount: '1000000', network: 'mainnet', sender: main.sender })
  assert.equal(main.calls[0].usdc, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')

  const custom = captureSender()
  await baseSettle({ to: EVM, amount: '1000000', usdcAddress: '0xCUSTOM', sender: custom.sender })
  assert.equal(custom.calls[0].usdc, '0xCUSTOM')
})

test('baseSettle: rejects a non-positive amount and a non-0x recipient', async () => {
  const { sender } = captureSender()
  await assert.rejects(() => baseSettle({ to: EVM, amount: '0', sender }), /positive atomic USDC/)
  await assert.rejects(() => baseSettle({ to: EVM, amount: 'abc', sender }), /positive atomic USDC/)
  await assert.rejects(() => baseSettle({ to: 'NotAnEvmAddress', amount: '1000000', sender }), /0x recipient/)
})

test('baseSettle: errors clearly when neither a sender nor a key is configured', async () => {
  const prev = process.env.EVM_PAYER_SECRET
  delete process.env.EVM_PAYER_SECRET
  try {
    await assert.rejects(() => baseSettle({ to: EVM, amount: '1000000' }), /EVM_PAYER_SECRET|private key/)
  } finally {
    if (prev !== undefined) process.env.EVM_PAYER_SECRET = prev
  }
})
