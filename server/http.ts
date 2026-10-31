import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import { proposalState } from '../src/lib/requests.ts'
import { proposalContext } from './data.ts'
import { run } from './db.ts'
import { BadRequest } from './photos.ts'

// Small helpers shared by the route files.

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Public address of the web app, used in emailed links. */
export const APP_URL = (process.env.APP_URL ?? 'http://localhost:5175').replace(/\/$/, '')

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export const fail = (res: Response, status: number, error: string) => res.status(status).json({ error })

export function optionalText(value: unknown, field: string, max = 1000): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new BadRequest(`${field} is invalid.`)
  if (value.length > max) throw new BadRequest(`${field} is too long (max ${max} characters).`)
  return value.trim() || null
}

export function textList(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) throw new BadRequest(`${field} is invalid.`)
  const items = value.map((v: string) => v.trim()).filter(Boolean)
  if (items.length > maxItems) throw new BadRequest(`Add at most ${maxItems} ${field.toLowerCase()}.`)
  if (items.some((v) => v.length > maxLength)) throw new BadRequest(`${field} entries must be under ${maxLength} characters.`)
  return [...new Set(items)]
}

/**
 * Records the proposed person's answer once the seeker has accepted — either by the
 * candidate themselves or by a matchmaker who contacted them.
 */
export function recordInterest(req: Request, res: Response, allowed: (candidateId: string) => boolean) {
  const ctx = proposalContext(req.params.id as string)
  if (!ctx || !allowed(ctx.proposal.candidateId)) return fail(res, 404, 'Proposal not found.')
  if (ctx.request.closedAt || proposalState(ctx.proposal) !== 'checking') return fail(res, 409, 'This has already been answered.')
  const { answer } = req.body ?? {}
  if (answer !== 'interested' && answer !== 'not_interested') return fail(res, 400, 'Answer must be interested or not_interested.')
  run(
    'UPDATE proposals SET candidate_response = ?, candidate_responded_at = ?, candidate_comment = ? WHERE id = ?',
    answer,
    Date.now(),
    optionalText(req.body.comment, 'Comment'),
    ctx.proposal.id,
  )
  res.json({ ok: true })
}
