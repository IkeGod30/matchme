import { useEffect, useRef, useState } from 'react'
import { formatFee } from '../config'
import { actions } from '../lib/store'
import type { Profile } from '../types'
import { Portrait } from './Portrait'

interface PaymentDialogProps {
  requestId: string
  proposalId: string
  match: Profile
  onClose: () => void
}

/**
 * PLACEHOLDER checkout. No card details are collected and nothing is charged — it only
 * records a test reference. Swap the "simulate" handler for a real provider
 * (e.g. Paystack, Flutterwave or Stripe Checkout) when payments are connected.
 */
export function PaymentDialog({ requestId, proposalId, match, onClose }: PaymentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<'confirm' | 'processing' | 'done'>('confirm')
  const [reference, setReference] = useState('')

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function simulatePayment() {
    setPhase('processing')
    window.setTimeout(() => {
      setReference(actions.recordPayment(requestId, proposalId))
      setPhase('done')
    }, 900)
  }

  return (
    <dialog ref={dialogRef} className="pay-dialog" onClose={onClose} aria-labelledby="pay-title">
      <div className="test-banner">
        Test mode — payments aren’t connected yet. No card details are collected and nothing is charged.
      </div>

      {phase !== 'done' ? (
        <>
          <header className="pay-header">
            <Portrait profile={match} size={64} round />
            <div>
              <h2 id="pay-title">Confirm your match with {match.name}</h2>
              <p className="muted small">You both said yes — this is the only time you pay.</p>
            </div>
          </header>

          <dl className="pay-lines">
            <div>
              <dt>Mutual match fee</dt>
              <dd>{formatFee()}</dd>
            </div>
            <div className="pay-total">
              <dt>Total due today</dt>
              <dd>{formatFee()}</dd>
            </div>
          </dl>

          <ul className="pay-includes">
            <li>Your matchmaker shares contact details with you both</li>
            <li>A personal introduction arranged by your matchmaker</li>
            <li>No subscriptions or upfront fees — ever</li>
          </ul>

          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => dialogRef.current?.close()} disabled={phase === 'processing'}>
              Not now
            </button>
            <button type="button" className="btn primary" onClick={simulatePayment} disabled={phase === 'processing'}>
              {phase === 'processing' ? 'Processing…' : `Simulate payment of ${formatFee()}`}
            </button>
          </div>
        </>
      ) : (
        <div className="pay-done">
          <div className="pay-check" aria-hidden="true">
            ✓
          </div>
          <h2 id="pay-title">You’re matched with {match.name}!</h2>
          <p className="muted">
            Payment recorded (test reference <code>{reference}</code>). Your matchmaker will be in touch shortly to share
            contact details and arrange your introduction.
          </p>
          <button type="button" className="btn primary" onClick={() => dialogRef.current?.close()}>
            Done
          </button>
        </div>
      )}
    </dialog>
  )
}
