// Assemble the static web surface served by Vercel's CDN from /public:
//   /                  → public/index.html         (landing page, committed)
//   /dashboard/        → public/dashboard/*         (operator SPA, generated here)
//
// The operator SPA references its assets at absolute /app.js and /styles.css, so
// to host it under /dashboard/ we copy it and rewrite those two paths. Its API
// calls (/api/*) are already absolute and hit the function unchanged.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src', 'operator', 'public')
const OUT = join(ROOT, 'public', 'dashboard')

await mkdir(OUT, { recursive: true })

// Assets verbatim — app.js fetches /api/* (absolute), correct from any path.
await copyFile(join(SRC, 'app.js'), join(OUT, 'app.js'))
await copyFile(join(SRC, 'styles.css'), join(OUT, 'styles.css'))

// index.html: re-root its two asset references under /dashboard/.
const html = await readFile(join(SRC, 'index.html'), 'utf8')
const rerooted = html
  .replaceAll('href="/styles.css"', 'href="/dashboard/styles.css"')
  .replaceAll('src="/app.js"', 'src="/dashboard/app.js"')
await writeFile(join(OUT, 'index.html'), rerooted)

console.log('build-web: wrote public/dashboard/{index.html,app.js,styles.css}')
