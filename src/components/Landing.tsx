import { useState, type CSSProperties } from 'react'
import { BODY_FEATURES, type FeatureKey } from '../data/attributes'
import { SAMPLE_PROFILES } from '../data/sampleProfiles'
import { FeaturePicker } from './FeaturePicker'
import { Portrait } from './Portrait'

const STEPS = [
  {
    title: 'Tell us about you',
    body: 'Your background, profession, where you live and what you look like — picked from pictures, not typed.',
  },
  {
    title: 'Describe who you want',
    body: 'Write a message about your ideal partner and set their location, race, nationality, profession and age.',
  },
  {
    title: 'Pick features from pictures',
    body: 'A visual wizard walks you through height, build, face, hair and more. Choose as many as you like — or none.',
  },
  {
    title: 'Your matchmaker proposes',
    body: 'A real matchmaker reviews your request and sends you hand-picked people. You accept or decline each one — and pay only when the interest is mutual.',
  },
]

const FEE_COMPARISON = [
  {
    them: 'Large fees paid upfront, before you’ve seen a single match',
    us: 'Nothing to pay upfront — requesting, reviewing and declining are free',
  },
  {
    them: 'Communication can go quiet once the fee has been paid',
    us: 'Track your request at every step and hear from your matchmaker directly',
  },
  {
    them: 'Introductions to people who don’t fit what you asked for',
    us: 'Every proposal is checked against your own request — location, background and features',
  },
  {
    them: 'You pay whether or not anyone is interested in you',
    us: 'You pay only after you’re matched with someone who has also said yes to you',
  },
]

const DEMO_FEATURES: FeatureKey[] = [
  'bodyType',
  'bustSize',
  'buttSize',
  'buttShape',
  'lips',
  'hairLength',
  'eyeColor',
]

const REASONS = [
  {
    title: 'Hand-picked, not swiped',
    body: 'No endless feed. Every person you see was chosen by a matchmaker who read your request.',
  },
  {
    title: 'Preferences that go deeper',
    body: 'Location, nationality, race, profession and specific physical features — matched both ways, so they want someone like you too.',
  },
  {
    title: 'You stay in control',
    body: 'Nothing happens until you accept. Decline with a comment and your matchmaker learns what you really want.',
  },
  {
    title: 'Private and confidential',
    body: 'Unlike informal matchmaking, where your photos and details can be passed around, your profile is never listed publicly. Only you, your matchmaker and the people you’re matched with can see it — unless you ask us to advertise your profile.',
  },
]

// PLACEHOLDER: invented quotes for the prototype. They are labelled as samples on the page.
// Replace with real, consented member testimonials before launch — publishing made-up
// reviews as genuine is misleading and illegal in many countries.
const TESTIMONIALS = [
  {
    quote:
      'I was tired of swiping. I wrote exactly what I wanted, and the second person my matchmaker sent me is now my fiancé.',
    name: 'Tolu A.',
    place: 'Lagos',
  },
  {
    quote:
      'Picking features from pictures felt strange at first, but it meant the matches actually looked like the people I’m drawn to.',
    name: 'James O.',
    place: 'London',
  },
  {
    quote:
      'I declined the first round with comments, and the next matches were spot on. It felt like someone was really listening.',
    name: 'Amina B.',
    place: 'Abuja',
  },
]

const FAQ = [
  {
    q: 'When do I pay?',
    a: 'Only after you’re matched with someone who has also shown interest in you. Creating a profile, sending a request, reviewing proposals and declining them cost nothing — there are no upfront fees.',
  },
  {
    q: 'Who is the matchmaker?',
    a: 'A person who reviews each request, searches the members for people who fit, and explains why they think each one is a good match.',
  },
  {
    q: 'What if I don’t like any of the matches?',
    a: 'Decline them — ideally with a short comment — and ask for another round. Your request goes back to the matchmaker.',
  },
  {
    q: 'Can I change what I’m looking for?',
    a: 'Yes. Edit your request at any time; your matchmaker sees the update straight away.',
  },
  {
    q: 'Who sees my photo and profile?',
    a: 'Only you, your matchmaker and the people your matchmaker proposes you to as a match. Your profile is kept confidential and is never shown publicly unless you ask us to advertise it.',
  },
]

const HERO_NAMES = ['Funmilayo', 'Daniel', 'Layla']

interface LandingProps {
  ctaLabel: string
  onStart: () => void
  onMatchmaker: () => void
  onFeatured: () => void
}

export function Landing({ ctaLabel, onStart, onMatchmaker, onFeatured }: LandingProps) {
  const [demoKey, setDemoKey] = useState<FeatureKey>(DEMO_FEATURES[0])
  const [demoPicks, setDemoPicks] = useState<Record<string, string[]>>({})
  const demoFeature = BODY_FEATURES.find((f) => f.key === demoKey)!
  const heroProfiles = HERO_NAMES.map((n) => SAMPLE_PROFILES.find((p) => p.name === n)).filter((p) => !!p)

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">Personal matchmaking</span>
          <h1>Describe the person you want to meet. A matchmaker finds them.</h1>
          <p className="lead">
            MatchMe isn’t another swipe app. You tell us exactly who you’re looking for — down to the features you’re
            drawn to — and a real matchmaker hand-picks people for you to accept or decline.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn primary large" onClick={onStart}>
              {ctaLabel}
            </button>
            <a className="btn ghost large" href="#how-it-works">
              How it works
            </a>
          </div>
          <ul className="hero-points">
            <li>No upfront fees — pay only when it’s mutual</li>
            <li>Picture-based preferences</li>
            <li>You decide who you meet</li>
          </ul>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="mock-note">
            <strong>From your matchmaker</strong>
            <p>I think you’ll like these three — each one fits what you described.</p>
          </div>
          {heroProfiles.map((p, i) => (
            <div key={p.id} className="mock-card" style={{ '--i': i } as CSSProperties}>
              <Portrait profile={p} size={64} />
              <div>
                <strong>
                  {p.name}, {p.age}
                </strong>
                <span className="muted small">
                  {p.jobTitle} · {p.city}
                </span>
                <span className="mock-fit">✓ Fits your request</span>
              </div>
              <div className="mock-actions">
                <span className="mock-btn">Decline</span>
                <span className="mock-btn yes">Accept</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p className="muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section pay-section">
        <div className="pay-intro">
          <span className="eyebrow">Fair pricing</span>
          <h2>Pay only when it’s a mutual match.</h2>
          <p className="muted">
            Many matchmakers ask for large fees upfront — and some then stop responding, or introduce you to someone
            who isn’t what you asked for. On MatchMe you pay nothing until you’re matched with someone who has{' '}
            <strong>also</strong> said they like you and are interested in meeting you.
          </p>
        </div>
        <div className="compare card" role="table" aria-label="Upfront-fee matchmakers compared with MatchMe">
          <div className="compare-row compare-head" role="row">
            <span role="columnheader">Typical upfront-fee matchmaker</span>
            <span role="columnheader">MatchMe</span>
          </div>
          {FEE_COMPARISON.map((row) => (
            <div key={row.us} className="compare-row" role="row">
              <span role="cell" className="compare-them">
                {row.them}
              </span>
              <span role="cell" className="compare-us">
                {row.us}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section split">
        <div>
          <span className="eyebrow">The feature wizard</span>
          <h2>Say what you’re drawn to — with pictures.</h2>
          <p className="muted">
            Words like “athletic” or “full lips” mean different things to different people. So you choose from picture
            examples, one feature at a time. Try it:
          </p>
          <div className="demo-tabs" role="tablist">
            {DEMO_FEATURES.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={key === demoKey}
                onClick={() => setDemoKey(key)}
              >
                {BODY_FEATURES.find((f) => f.key === key)!.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card demo-picker">
          <h3>{demoFeature.question}</h3>
          <FeaturePicker
            key={demoKey}
            feature={demoFeature}
            multiple
            selected={demoPicks[demoKey] ?? []}
            onChange={(values) => setDemoPicks((prev) => ({ ...prev, [demoKey]: values }))}
          />
        </div>
      </section>

      <section className="landing-section">
        <h2>Why a matchmaker?</h2>
        <div className="reasons two-by-two">
          {REASONS.map((r) => (
            <article key={r.title} className="card">
              <h3>{r.title}</h3>
              <p className="muted">{r.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <h2>What members say</h2>
          <span className="demo-tag">Sample testimonials · placeholder content</span>
        </div>
        <div className="reasons">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card testimonial">
              <blockquote>“{t.quote}”</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span className="muted small">{t.place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-section faq">
        <h2>Questions</h2>
        {FAQ.map((item) => (
          <details key={item.q} className="card">
            <summary>{item.q}</summary>
            <p className="muted">{item.a}</p>
          </details>
        ))}
      </section>

      <section className="landing-cta card">
        <h2>Ready to meet someone who fits?</h2>
        <p className="muted">
          It takes about five minutes to describe yourself and the person you’re looking for. No upfront fees — you
          pay only when it’s a mutual match.
        </p>
        <button type="button" className="btn primary large" onClick={onStart}>
          {ctaLabel}
        </button>
      </section>

      <footer className="landing-footer">
        <span>
          <span className="brand-mark" aria-hidden="true">♥</span> MatchMe
        </span>
        <span className="footer-links">
          <button type="button" className="link-btn" onClick={onFeatured}>
            See featured members
          </button>
          <button type="button" className="link-btn" onClick={onMatchmaker}>
            Are you a matchmaker? Open the matchmaker dashboard →
          </button>
        </span>
      </footer>
    </div>
  )
}
