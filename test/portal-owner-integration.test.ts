import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
test('actual portal routes refuse cross-user identifiers before network/payment work',()=>{
 const output=execFileSync(process.execPath,[new URL('./portal-owner-integration.fixture.mjs',import.meta.url).pathname],{encoding:'utf8',timeout:20000})
 assert.ok(output.includes('payout pause PASS'))
})
