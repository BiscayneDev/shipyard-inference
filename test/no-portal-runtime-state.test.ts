import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
test('runtime portal state is never tracked or deployed',()=>{
 const tracked=execFileSync('git',['ls-files','examples/chat-portal/.data/'],{encoding:'utf8'})
 assert.equal(tracked.trim(),'','Portal runtime state must not be committed')
 assert.ok(readFileSync(new URL('../.gitignore',import.meta.url),'utf8').includes('examples/chat-portal/.data/'))
 assert.ok(readFileSync(new URL('../.vercelignore',import.meta.url),'utf8').includes('examples/chat-portal/.data/'))
 const build=readFileSync(new URL('../scripts/build-web.mjs',import.meta.url),'utf8')
 assert.ok(build.includes('node_modules|\\.data'),'Build copy must exclude runtime state')
})
