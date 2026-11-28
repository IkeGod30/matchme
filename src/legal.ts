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
 * (src/components/legal/). Have a lawyer in each country you operate in review the pages.
 */
export const LEGAL = {
  /** The legal entity that runs MatchMeHub and is responsible for members' data. */
  company: 'Zillion Services Ltd',
  /** Company registration number, with the state or country it's registered in, in brackets. */
  registration: '5766255 (New York)',
  privacyEmail: 'policy@matchmehub.com',
  supportEmail: 'policy@matchmehub.com',
  safetyEmail: 'policy@matchmehub.com',
  /** Where the servers and backups are (Vercel hosts the app, Turso the database). */
  hosting: 'Vercel and Turso, in the United States',
  /** How long deleted data can stay in backups before it's overwritten. */
  backupDays: 30,
  /** How long payment records are kept for tax and accounting law. */
  paymentRecordYears: 6,
  /** The law and courts that govern the terms. */
  governingLaw: 'the laws of the State of New York',
  /** Date the current versions took effect. */
  updated: '25 November 2026',
}
