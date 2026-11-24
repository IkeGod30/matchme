import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'

// Lets the data scripts work on a hosted database and Blob store: `--target staging` or
// `--target production`. Without --target they use the local database file and photos, exactly
// like `npm run dev`. Must be imported before db.ts, which reads the settings when it loads.
//
// Settings for a target come from two git-ignored files in the project folder:
//   .env.<target>        downloaded from Vercel:  npx vercel env pull .env.staging --environment=preview
//                        (rewritten on every download)
//   .env.<target>.local  typed in by hand, never touched by Vercel: values Vercel won't download
//                        (Sensitive ones arrive as "[SENSITIVE]"), e.g. TURSO_AUTH_TOKEN
// Precedence: a variable already set in the terminal > .local > the downloaded file. Empty and
// "[SENSITIVE]" values count as missing. Vercel-only entries (VERCEL=1, VERCEL_ENV, TURBO_*, …)
// are skipped so the scripts don't act as if they were a deployment; VERCEL_OIDC_TOKEN, the
// Blob store's sign-in, is kept.

const flag = process.argv.indexOf('--target')
export const TARGET = flag >= 0 ? (process.argv[flag + 1] ?? '') : 'local'

const PLACEHOLDER = '[SENSITIVE]'
const usable = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '' && value.trim() !== PLACEHOLDER
const deploymentOnly = (name: string) => (name.startsWith('VERCEL') && name !== 'VERCEL_OIDC_TOKEN') || /^(TURBO_|NX_)/.test(name)

function stop(message: string): never {
  console.error(`\n--target ${TARGET}: ${message}\n`)
  process.exit(1)
}

/** When a Vercel OIDC token (a JWT) expires, or undefined if it can't be read. */
function tokenExpiry(token: string): Date | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { exp?: number }
    return payload.exp ? new Date(payload.exp * 1000) : undefined
  } catch {
    return undefined
  }
}

if (TARGET !== 'local') {
  if (!/^[a-z0-9-]+$/.test(TARGET)) stop('use --target staging or --target production.')

  // MATCHMEHUB_ENV_DIR is only for the automated tests.
  const dir = process.env.MATCHMEHUB_ENV_DIR ?? path.resolve(import.meta.dirname, '..')
  const pulledFile = path.join(dir, `.env.${TARGET}`)
  const localFile = `${pulledFile}.local`
  const pulledName = path.basename(pulledFile)
  const localName = path.basename(localFile)
  const vercelEnv = TARGET === 'staging' ? 'preview' : TARGET
  const pullCommand = `npx vercel env pull ${pulledName} --environment=${vercelEnv}`

  if (!existsSync(pulledFile) && !existsSync(localFile)) {
    stop(`no settings found. Download them with:  ${pullCommand}`)
  }
  const read = (file: string) => (existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {})

  const fromTerminal = new Set(Object.keys(process.env).filter((name) => usable(process.env[name])))
  const settings: Record<string, string> = {}
  for (const [name, value] of Object.entries(read(pulledFile))) {
    if (!deploymentOnly(name) && usable(value)) settings[name] = value
  }
  for (const [name, value] of Object.entries(read(localFile))) {
    if (usable(value)) settings[name] = value
  }
  for (const [name, value] of Object.entries(settings)) {
    if (!fromTerminal.has(name)) process.env[name] = value
  }

  const env = process.env
  for (const name of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']) {
    if (!usable(env[name])) {
      stop(
        `${name} is missing (Vercel doesn't download values marked Sensitive). Add it to ${localName}:\n` +
          `  ${name}=<value from the Turso dashboard>`,
      )
    }
  }
  if (!usable(env.BLOB_STORE_ID) && !usable(env.BLOB_READ_WRITE_TOKEN)) {
    stop(`no Blob store found (BLOB_STORE_ID). Connect the store to the ${vercelEnv} environment in Vercel, then:  ${pullCommand}`)
  }
  if (usable(env.BLOB_STORE_ID) && !usable(env.BLOB_READ_WRITE_TOKEN)) {
    if (!usable(env.VERCEL_OIDC_TOKEN)) stop(`the Blob sign-in (VERCEL_OIDC_TOKEN) is missing. Download it with:  ${pullCommand}`)
    const expires = tokenExpiry(env.VERCEL_OIDC_TOKEN)
    if (expires && expires.getTime() < Date.now() + 60_000) {
      stop(`the Blob sign-in (VERCEL_OIDC_TOKEN) expired at ${expires.toLocaleString()}. Download a fresh one with:  ${pullCommand}`)
    }
  }

  const host = env.TURSO_DATABASE_URL!.replace(/^[a-z]+:\/\//, '').split(/[/?]/)[0]
  console.log(`[${TARGET}] database ${host} · Blob store ${env.BLOB_STORE_ID ?? '(token)'}`)
}
