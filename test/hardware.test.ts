import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probeHardware, ladderForHardware } from '../src/connect/hardware.js'

test('probeHardware parses macOS sysctl output', () => {
  const hw = probeHardware({
    execSync: (cmd: string) =>
      cmd.includes('hw.memsize') ? '8589934592' : 'Apple M2',
  })
  assert.equal(hw!.totalRamGb, 8)
  assert.equal(hw!.chip, 'Apple M2')
  assert.equal(hw!.platform, 'darwin')
})

test('ladderForHardware maps 8GB to 3B-class models', () => {
  const ladder = ladderForHardware({ totalRamGb: 8, chip: 'Apple M2', platform: 'darwin' })
  assert.ok(ladder.maxParametersB <= 4)
  assert.ok(ladder.models.length >= 1)
  assert.ok(ladder.models.every((m) => m.parametersB <= 4))
})

test('ladderForHardware maps 64GB to 70B-class models', () => {
  const ladder = ladderForHardware({ totalRamGb: 64, chip: 'Apple M4 Pro', platform: 'darwin' })
  assert.ok(ladder.maxParametersB >= 32)
})

test('unknown hardware falls back to a conservative ladder', () => {
  const ladder = ladderForHardware(null)
  assert.equal(ladder.maxParametersB, 3)
  assert.equal(ladder.source, 'fallback')
})
