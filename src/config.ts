/** Fee a seeker pays once a match is mutual. Change the amount or currency here. */
export const MATCH_FEE = { amount: 49, currency: 'USD' }

export function formatFee(): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: MATCH_FEE.currency }).format(MATCH_FEE.amount)
}
