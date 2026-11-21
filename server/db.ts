import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient, type InStatement, type ResultSet } from '@libsql/client'
import { localDbFile } from './db-paths.ts'

// The database. In production it's Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN); locally it's
// the SQLite file in server/data/ (libSQL reads and writes the same file format). The schema
// and its upgrades live in migrate.ts, which runs once per deploy (and when the dev server starts).

type Param = string | number | null

const remoteUrl = process.env.TURSO_DATABASE_URL?.trim() || undefined
if (!remoteUrl && process.env.VERCEL) {
  throw new Error('TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) in the Vercel project settings.')
}

/** True when the database is hosted (Turso) rather than a local file. */
export const isRemoteDb = !!remoteUrl && !remoteUrl.startsWith('file:')

function localUrl(): string {
  const file = localDbFile()
  mkdirSync(path.dirname(file), { recursive: true })
  return `file:${file.replace(/\\/g, '/')}`
}

/** A short label for logs and scripts, without any token. */
export const dbLabel = remoteUrl ? remoteUrl.replace(/\?.*$/, '') : localUrl()

export const client = createClient({
  url: remoteUrl ?? localUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
})

/* ---------- Typed helpers (rows come back as plain objects) ---------- */

function rowsOf<T>(result: ResultSet): T[] {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((column, i) => [column, row[i]]))) as T[]
}

export interface RunResult {
  changes: number
  lastInsertRowid: bigint | undefined
}

/** The query helpers. Inside a transaction, the same helpers run on the transaction. */
export interface Queries {
  all: <T>(sql: string, ...params: Param[]) => Promise<T[]>
  get: <T>(sql: string, ...params: Param[]) => Promise<T | undefined>
  run: (sql: string, ...params: Param[]) => Promise<RunResult>
}

function queries(execute: (statement: InStatement) => Promise<ResultSet>): Queries {
  return {
    all: async <T>(sql: string, ...params: Param[]) => rowsOf<T>(await execute({ sql, args: params })),
    get: async <T>(sql: string, ...params: Param[]) => rowsOf<T>(await execute({ sql, args: params }))[0],
    run: async (sql: string, ...params: Param[]) => {
      const result = await execute({ sql, args: params })
      return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid }
    },
  }
}

/** SQLite answers "busy" when another connection holds the write lock; the statement didn't run. */
const isBusy = (error: unknown) => /SQLITE_BUSY|database is locked/i.test(String((error as Error)?.message ?? error))

async function retryWhenBusy<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isBusy(error) || attempt >= 40) throw error
      await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 75))
    }
  }
}

export const db: Queries = queries((statement) => retryWhenBusy(() => client.execute(statement)))
export const { all, get, run } = db

/**
 * Runs `fn` atomically in a write transaction; everything inside must use the `tx` helpers.
 * Writers are serialized, so reads inside see the latest data. If the database is busy, the
 * whole transaction is retried, so `fn` must not have side effects outside the database.
 */
export async function transaction<T>(fn: (tx: Queries) => Promise<T>): Promise<T> {
  return retryWhenBusy(async () => {
    const tx = await client.transaction('write')
    try {
      const result = await fn(queries((statement) => tx.execute(statement)))
      await tx.commit()
      return result
    } catch (error) {
      if (!tx.closed) await tx.rollback().catch(() => {})
      throw error
    } finally {
      tx.close()
    }
  })
}

/** `?, ?, ?` for an IN (...) list. */
export const placeholders = (values: readonly unknown[]) => values.map(() => '?').join(', ')
