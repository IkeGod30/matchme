export type LegalPageKind = 'privacy' | 'terms' | 'cookies' | 'safety'

/** The legal pages, in footer order. Each one lives at /#<kind>. */
export const LEGAL_PAGES: { kind: LegalPageKind; title: string }[] = [
  { kind: 'privacy', title: 'Privacy policy' },
  { kind: 'terms', title: 'Terms of use' },
  { kind: 'cookies', title: 'Cookie notice' },
  { kind: 'safety', title: 'Safety & conduct' },
]

/**
 * Details used by the privacy policy, terms of use, cookie notice and safety pages
 * (src/components/legal/). Replace every [BRACKETED] value before launch, have a lawyer in each
 * country you operate in review the pages, then set `draft` to false to remove the draft banner.
 */
export const LEGAL = {
  /** Shows a "draft" banner on every legal page until the details below are filled in and reviewed. */
  draft: true,
  /** The legal entity that runs MatchMeHub and is responsible for members' data. */
  company: 'Zillion Services Ltd',
  /** Registered address, including country. */
  address: '[REGISTERED ADDRESS]',
  /** Company registration number (e.g. CAC RC number in Nigeria, Companies House number in the UK). */
  registration: '[COMPANY REGISTRATION NUMBER]',
  privacyEmail: 'privacy@matchmehub.com',
  supportEmail: '[support@your-domain.com]',
  safetyEmail: '[safety@your-domain.com]',
  /** Where the servers and backups are, e.g. "Amazon Web Services, Frankfurt (EU)". */
  hosting: '[HOSTING PROVIDER AND COUNTRY]',
  /** Who sends MatchMeHub's emails (the SMTP service in server/mailer.ts). */
  emailProvider: '[EMAIL PROVIDER, e.g. Brevo or SendGrid]',
  /** Who takes card payments once real payments replace the placeholder. */
  paymentProvider: '[PAYMENT PROVIDER, e.g. Paystack, Flutterwave or Stripe]',
  /** How long deleted data can stay in backups before it's overwritten. */
  backupDays: 30,
  /** How long payment records are kept for tax and accounting law. */
  paymentRecordYears: 6,
  /** The law and courts that govern the terms. */
  governingLaw: '[GOVERNING LAW, e.g. the laws of the Federal Republic of Nigeria]',
  /** Date the current versions took effect. */
  updated: '25 November 2026',
}
