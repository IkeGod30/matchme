import { useState, type CSSProperties } from 'react'
import { BODY_FEATURES, type FeatureKey } from '../../data/attributes'
import { SAMPLE_PROFILES } from '../../data/sampleProfiles'
import { FeaturePicker } from '../shared/FeaturePicker'
import { Portrait } from '../shared/Portrait'

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

export type Audience = 'seeker' | 'matchmaker'

interface SideProps {
  ctaLabel: string
  onStart: () => void
  /** Shown only to visitors who aren't signed in. */
  onLogin?: () => void
  onFeatured: () => void
  onSwitch: () => void
}

function SeekerLanding({ ctaLabel, onStart, onLogin, onFeatured, onSwitch }: SideProps) {
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
            {onLogin && (
              <button type="button" className="btn ghost large" onClick={onLogin}>
                Seeker log in
              </button>
            )}
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
          <button type="button" className="link-btn" onClick={onSwitch}>
            Are you a matchmaker? See the matchmaker side →
          </button>
        </span>
      </footer>
    </div>
  )
}

/* ---------- Matchmaker side ---------- */

const MM_STEPS = [
  { title: 'Apply', body: 'Tell us about yourself and your matchmaking experience. It takes a few minutes and costs nothing.' },
  {
    title: 'Get approved',
    body: 'A matchmaker on the MatchMe team reviews your application. Invited by a teammate? You’re approved straight away.',
  },
  {
    title: 'Take on requests',
    body: 'Pick up seekers’ requests: their message, background and the physical features they chose from pictures.',
  },
  {
    title: 'Propose & introduce',
    body: 'Send hand-picked matches. When both people say yes and the seeker confirms, you arrange the introduction.',
  },
]

const MM_TOOLS = [
  { title: 'Ranked shortlists', body: 'Every member is scored against the request — both ways — so the best fits rise to the top.' },
  { title: 'Picture-based preferences', body: 'No guessing what “athletic” or “curvy” means: seekers chose from picture examples.' },
  { title: 'Private team notes', body: 'Keep notes on each request that only matchmakers see — never the seeker.' },
  { title: 'Member directory', body: 'Search every member by name, city, job, gender or relationship status.' },
  { title: 'Mutual-interest tracking', body: 'See who accepted, record the other person’s answer, and know when a match is paid.' },
  { title: 'Teamwork built in', body: 'Claim requests, hand them over to a teammate, and invite new matchmakers.' },
]

const MM_FAQ = [
  {
    q: 'Who can become a matchmaker?',
    a: 'Anyone who cares about helping people build lasting relationships and can treat members’ information with discretion. Professional or community matchmaking experience helps, but tell us about yours either way.',
  },
  {
    q: 'What happens after I apply?',
    a: 'You can log in straight away, but you won’t see any members or requests until a matchmaker on the team approves your application. You’ll get an email when they decide.',
  },
  {
    q: 'A matchmaker invited me. Do I need to apply?',
    a: 'No — use the invitation link from your email. Invited matchmakers are approved as soon as they sign up.',
  },
  {
    q: 'What can matchmakers see?',
    a: 'Approved matchmakers can see members’ full profiles and requests, so they can make good matches. That’s why every applicant is reviewed, and why matchmakers agree to keep everything confidential.',
  },
]

function MatchmakerLanding({ ctaLabel, onStart, onLogin, onFeatured, onSwitch }: SideProps) {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">For matchmakers</span>
          <h1>Bring people together — with the tools to do it well.</h1>
          <p className="lead">
            MatchMe gives matchmakers a private workspace: detailed, picture-based requests from seekers, a ranked
            shortlist for every request, and one place to propose matches and follow every answer.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn primary large" onClick={onStart}>
              {ctaLabel}
            </button>
            {onLogin && (
              <button type="button" className="btn ghost large" onClick={onLogin}>
                Matchmaker log in
              </button>
            )}
          </div>
          <ul className="hero-points">
            <li>Free to apply</li>
            <li>Every applicant reviewed by our team</li>
            <li>Private by design</li>
          </ul>
        </div>

        <div className="hero-visual mm-visual" aria-hidden="true">
          <div className="mock-stats">
            <div className="mock-stat">
              <strong>3</strong>
              <span>Unassigned requests</span>
            </div>
            <div className="mock-stat">
              <strong>5</strong>
              <span>My open requests</span>
            </div>
            <div className="mock-stat">
              <strong>2</strong>
              <span>Awaiting payment</span>
            </div>
          </div>
          {[
            { name: 'Kwame, 34', where: 'Accra', status: 'Needs matches', action: 'Take it on' },
            { name: 'Amara, 29', where: 'Lagos', status: 'Ask candidate', action: 'Record answer' },
            { name: 'Nia, 32', where: 'New York', status: 'Paid — introduce', action: 'Introduce' },
          ].map((row, i) => (
            <div key={row.name} className="mock-card" style={{ '--i': i } as CSSProperties}>
              <span className="mock-dot">{row.name[0]}</span>
              <div>
                <strong>{row.name}</strong>
                <span className="muted small">{row.where}</span>
                <span className="mock-fit">{row.status}</span>
              </div>
              <div className="mock-actions">
                <span className="mock-btn yes">{row.action}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>How it works for matchmakers</h2>
        <ol className="steps">
          {MM_STEPS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p className="muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section">
        <h2>Your workspace</h2>
        <div className="reasons tools-grid">
          {MM_TOOLS.map((tool) => (
            <article key={tool.title} className="card">
              <h3>{tool.title}</h3>
              <p className="muted">{tool.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <article className="card trust-card">
          <span className="eyebrow">A position of trust</span>
          <h2>Members trust you with their private lives.</h2>
          <p className="muted">
            Matchmakers see full profiles — photos, preferences and personal details that members don’t share
            publicly. Every matchmaker agrees to keep this information confidential, to share a member’s profile only
            with the people they propose, and never to contact members outside MatchMe for personal reasons.
          </p>
        </article>
      </section>

      <section className="landing-section faq">
        <h2>Questions</h2>
        {MM_FAQ.map((item) => (
          <details key={item.q} className="card">
            <summary>{item.q}</summary>
            <p className="muted">{item.a}</p>
          </details>
        ))}
      </section>

      <section className="landing-cta card">
        <h2>Ready to help people find each other?</h2>
        <p className="muted">Apply in a few minutes. A matchmaker on our team will review your application.</p>
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
          <button type="button" className="link-btn" onClick={onSwitch}>
            Looking for a partner? See the seeker side →
          </button>
        </span>
      </footer>
    </div>
  )
}

/* ---------- Page with the Seeker | Matchmaker toggle ---------- */

export function AudienceToggle({ audience, onChange }: { audience: Audience; onChange: (audience: Audience) => void }) {
  return (
    <div className="audience-toggle" role="tablist" aria-label="I am a">
      <button type="button" role="tab" aria-selected={audience === 'seeker'} onClick={() => onChange('seeker')}>
        <strong>Seeker</strong>
        <span>I’m looking for a partner</span>
      </button>
      <button type="button" role="tab" aria-selected={audience === 'matchmaker'} onClick={() => onChange('matchmaker')}>
        <strong>Matchmaker</strong>
        <span>I bring people together</span>
      </button>
    </div>
  )
}

interface LandingProps {
  audience: Audience
  onAudience: (audience: Audience) => void
  signedIn: boolean
  seekerCta: string
  onSeekerStart: () => void
  matchmakerCta: string
  onMatchmakerStart: () => void
  onLogin: (audience: Audience) => void
  onFeatured: () => void
}

export function Landing(props: LandingProps) {
  const { audience, onAudience, signedIn, onLogin, onFeatured } = props
  const switchTo = (next: Audience) => {
    onAudience(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <div className="stack">
      <AudienceToggle audience={audience} onChange={onAudience} />
      {audience === 'seeker' ? (
        <SeekerLanding
          ctaLabel={props.seekerCta}
          onStart={props.onSeekerStart}
          onLogin={signedIn ? undefined : () => onLogin('seeker')}
          onFeatured={onFeatured}
          onSwitch={() => switchTo('matchmaker')}
        />
      ) : (
        <MatchmakerLanding
          ctaLabel={props.matchmakerCta}
          onStart={props.onMatchmakerStart}
          onLogin={signedIn ? undefined : () => onLogin('matchmaker')}
          onFeatured={onFeatured}
          onSwitch={() => switchTo('seeker')}
        />
      )}
    </div>
  )
}
