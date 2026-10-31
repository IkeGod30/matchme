import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { DATA_DIR } from './db-paths.ts'

// Sends email through SMTP when SMTP_HOST is set (e.g. Gmail, SendGrid, Mailgun, Brevo).
// Without it — in local development — emails are written to server/data/outbox/ and
// printed to the console instead, so flows like password reset can still be tested.

const OUTBOX = path.join(DATA_DIR, 'outbox')
const FROM = process.env.MAIL_FROM ?? 'MatchMe <no-reply@matchme.local>'

const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null

export interface Email {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail(email: Email): Promise<void> {
  if (transport) {
    await transport.sendMail({ from: FROM, ...email })
    return
  }
  mkdirSync(OUTBOX, { recursive: true })
  const file = path.join(OUTBOX, `${Date.now()}-${email.to.replace(/[^a-z0-9@.]+/gi, '_')}.txt`)
  writeFileSync(file, `From: ${FROM}\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`)
  console.log(`\n✉  Email to ${email.to} (SMTP not configured — saved to ${path.relative(process.cwd(), file)})`)
  console.log(`   Subject: ${email.subject}\n${email.text.replace(/^/gm, '   ')}\n`)
}

export function isEmailConfigured(): boolean {
  return transport !== null
}
