// Builds the deployment in Vercel's Build Output format (.vercel/output), after `npm run build`
// has built the web app into dist/:
//
//   .vercel/output/static/              the web app (dist/)
//   .vercel/output/functions/api.func/  the whole API bundled into one file (one function)
//   .vercel/output/config.json          routing (/api/* → the function, other paths → the app) and the cron job
//
// Run by `npm run vercel-build` (Vercel's build command). Bundling makes the deployment independent
// of how Vercel would otherwise compile the server's TypeScript.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, '.vercel', 'output')
const dist = path.join(root, 'dist')
const fn = path.join(out, 'functions', 'api.func')

if (!existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ is missing. Run `npm run build` first.')

rmSync(out, { recursive: true, force: true })
mkdirSync(fn, { recursive: true })

// The web app, served as static files.
cpSync(dist, path.join(out, 'static'), { recursive: true })

// The API. On Vercel the database is always hosted, so the HTTP-only libSQL client is used
// (no native SQLite module to ship).
await build({
  entryPoints: [path.join(root, 'server', 'vercel.ts')],
  outfile: path.join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  alias: { '@libsql/client': '@libsql/client/web' },
  // Some bundled CommonJS packages call require() for Node's built-in modules.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  legalComments: 'none',
  logLevel: 'warning',
})

writeFileSync(
  path.join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs24.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 30,
    },
    null,
    2,
  ),
)
writeFileSync(path.join(fn, 'package.json'), JSON.stringify({ type: 'module' }))

writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Hashed build assets never change, so browsers may keep them.
        { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        // Every other address is a page of the single-page app (/, /matchmaker, /admin, …).
        { src: '^/.*$', dest: '/index.html' },
      ],
      crons: [{ path: '/api/internal/cleanup', schedule: '0 3 * * *' }],
    },
    null,
    2,
  ),
)

console.log('Vercel build output written to .vercel/output')
