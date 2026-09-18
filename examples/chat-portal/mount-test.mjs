// Mount smoke test: portal mounted at /portal in a parent Hono app.
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { portalApp } from './server.mjs'

const root = new Hono()
root.route('/portal', portalApp)
root.get('/', (c) => c.text('root'))
serve({ fetch: root.fetch, port: 8791 })
console.log('mount test → http://localhost:8791/portal/')
