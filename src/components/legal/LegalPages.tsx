import type { ReactNode } from 'react'
import { formatFee } from '../../config'
import { LEGAL, type LegalPageKind } from '../../legal'

/** A link to a legal page that opens in a new tab, so a half-filled form isn't lost. */
export function LegalLink({ kind, children }: { kind: LegalPageKind; children: ReactNode }) {
  return (
    <a href={`/#${kind}`} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

const Email = ({ to }: { to: string }) => <a href={`mailto:${to}`}>{to}</a>

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="card legal-page">
      {LEGAL.draft && (
        <p className="legal-draft small" role="note">
          <strong>Draft.</strong> Details in [brackets] still need filling in, and this notice should be reviewed by
          a lawyer before MatchMeHub launches.
        </p>
      )}
      <h1>{title}</h1>
      <p className="muted small">Last updated: {LEGAL.updated}</p>
      <p className="legal-intro">{intro}</p>
      {children}
    </article>
  )
}

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  if (kind === 'privacy') return <PrivacyPolicy />
  if (kind === 'terms') return <TermsOfUse />
  if (kind === 'cookies') return <CookieNotice />
  return <SafetyAndConduct />
}

function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy policy"
      intro="MatchMeHub is a matchmaking service: real matchmakers read what you tell us and introduce you to people who fit. That only works if you trust us with personal details, so this policy explains plainly what we collect, who sees it, how long we keep it and the choices you have."
    >
      <h2>1. Who we are</h2>
      <p>
        MatchMeHub is run by {LEGAL.company} ({LEGAL.registration}), {LEGAL.address} (“MatchMeHub”, “we”, “us”). We are
        responsible for (the “controller” of) the personal data described here. Questions or requests:{' '}
        <Email to={LEGAL.privacyEmail} />.
      </p>
      <p>
        We follow the Nigeria Data Protection Act 2023, the EU and UK General Data Protection Regulation (GDPR) and,
        for California residents, the California Consumer Privacy Act (CCPA/CPRA). Where these laws differ we apply
        the stricter standard to everyone.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> email address and password. We store only a scrambled (hashed) version of
          your password, never the password itself.
        </li>
        <li>
          <strong>Your profile:</strong> name, age, gender, city, country, nationality, race / ethnicity, religion,
          relationship status, profession, job title, “about me” text, a description of your appearance (such as
          height, build and hair) and up to six photos.
        </li>
        <li>
          <strong>Your preferred contact details:</strong> the phone number or email address you want your
          matchmaker to use.
        </li>
        <li>
          <strong>What you’re looking for:</strong> your message to the matchmaker and your preferences, including
          the gender(s), ages, places, backgrounds, religions and appearance you’re interested in.
        </li>
        <li>
          <strong>Your matchmaking activity:</strong> your match requests, the people proposed to you or that you
          asked to meet, your answers and comments, and notes your matchmaker writes about your request.
        </li>
        <li>
          <strong>Payments:</strong> when you confirm a match, our payment provider ({LEGAL.paymentProvider})
          processes your payment. We receive a confirmation and reference number, never your full card details.
        </li>
        <li>
          <strong>Matchmaker applicants:</strong> name, email, experience and languages.
        </li>
        <li>
          <strong>Technical data:</strong> a sign-in cookie (see our <LegalLink kind="cookies">cookie notice</LegalLink>)
          and your IP address, which we use briefly to block repeated failed log-ins.
        </li>
      </ul>

      <h2>3. Sensitive information</h2>
      <p>
        Some of what you share is especially sensitive under data protection law: your <strong>race or
        ethnicity</strong>, your <strong>religion</strong>, your <strong>photos</strong>, and the genders you’re
        interested in, which can reveal your <strong>sexual orientation</strong>. We use these only to find and
        propose matches, and only with your explicit consent, which you give when you create your account and add
        them to your profile. You can choose “Prefer not to say” for religion, change any of these details at any
        time, or withdraw your consent by deleting your account. Withdrawing consent doesn’t affect what we did
        before.
      </p>

      <h2>4. Why we use it, and our legal bases</h2>
      <ul>
        <li>
          <strong>To provide the service you signed up for</strong> (performance of our contract with you): running
          your account, matching, proposals, introductions, payments and service emails such as password resets.
        </li>
        <li>
          <strong>With your consent:</strong> using sensitive information (section 3) and showing your card on the
          public Featured page if you turn that on.
        </li>
        <li>
          <strong>For our legitimate interests</strong>, balanced against yours: keeping MatchMeHub secure, preventing
          fraud and abuse, enforcing our <LegalLink kind="terms">terms</LegalLink> and improving how matchmakers
          work.
        </li>
        <li>
          <strong>To meet legal obligations:</strong> keeping payment records for tax law, and responding to lawful
          requests from authorities.
        </li>
      </ul>
      <p>
        We don’t sell your personal data, share it for advertising, or make automated decisions about you: every
        match is chosen by a person.
      </p>

      <h2>5. Who can see your information</h2>
      <ul>
        <li>
          <strong>Our matchmakers</strong> can see every member’s full profile, preferences and requests, because
          finding matches means comparing members. They agree to a confidentiality pledge and our{' '}
          <LegalLink kind="safety">matchmaker code of conduct</LegalLink>.
        </li>
        <li>
          <strong>People you’re proposed to, or who are proposed to you,</strong> see your profile and photos and the
          message you wrote about who you’re looking for — not your detailed preferences and not your contact
          details.
        </li>
        <li>
          <strong>Your match</strong> receives your preferred contact details from your matchmaker only after you’ve
          both said yes and the match has been confirmed.
        </li>
        <li>
          <strong>Everyone on the internet</strong> sees your Featured card, but only if you choose to be featured.
          It shows your name, gender, city, profession or job title, “about me” text, main photo and your
          “looking for” message. It never shows your age, contact details, religion, race, relationship status or
          other photos. You can turn it off at any time.
        </li>
        <li>
          <strong>MatchMeHub administrators</strong> can view accounts to support members and keep the service safe.
        </li>
        <li>
          <strong>Service providers</strong> who process data for us under contract and only on our instructions:
          hosting ({LEGAL.hosting}), email ({LEGAL.emailProvider}) and payments ({LEGAL.paymentProvider}).
        </li>
        <li>
          <strong>Authorities,</strong> when the law requires it or to protect someone’s safety.
        </li>
      </ul>

      <h2>6. International transfers</h2>
      <p>
        Our servers are with {LEGAL.hosting}, and our providers may process data in other countries. When your data
        leaves your country we use the safeguards the law requires, such as adequacy decisions or standard
        contractual clauses.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>
          <strong>Your account, profile and requests:</strong> until you delete your account. Deleting it (My profile
          → Delete account) removes your profile, photos, requests and proposals straight away. Copies in backups
          are overwritten within {LEGAL.backupDays} days.
        </li>
        <li>
          <strong>Payment records:</strong> {LEGAL.paymentRecordYears} years, as tax and accounting law requires.
        </li>
        <li>
          <strong>Sign-in sessions</strong> end after 30 days or when you log out, and{' '}
          <strong>password-reset links</strong> expire after one hour.
        </li>
        <li>
          <strong>Declined matchmaker applications</strong> are deleted when they’re declined.
        </li>
      </ul>

      <h2>8. Your rights</h2>
      <p>Depending on where you live, you can:</p>
      <ul>
        <li>see the personal data we hold about you and get a copy, including in a portable format;</li>
        <li>correct it — most of it you can edit yourself in My profile;</li>
        <li>delete it — delete your account in My profile, or ask us;</li>
        <li>object to, or ask us to restrict, how we use it;</li>
        <li>withdraw your consent at any time (section 3), and turn off your Featured card;</li>
        <li>not be treated differently for using these rights.</li>
      </ul>
      <p>
        Email <Email to={LEGAL.privacyEmail} /> and we’ll reply within one month (45 days for California
        residents). We may need to confirm it’s you first. If you’re unhappy with our answer you can complain to your
        data protection authority — in Nigeria the Nigeria Data Protection Commission (NDPC), in the UK the
        Information Commissioner’s Office (ICO), in the EU your national authority, and in California the California
        Privacy Protection Agency.
      </p>

      <h2>9. How we protect it</h2>
      <p>
        Passwords are hashed; sign-in cookies can’t be read by scripts and are sent only over encrypted (HTTPS)
        connections; each kind of account (member, matchmaker, administrator) has its own separate log-in; and staff
        see only what their role needs. No system is perfectly secure: if a breach puts you at risk we’ll tell you
        and the authorities as the law requires.
      </p>

      <h2>10. Age</h2>
      <p>
        MatchMeHub is only for adults aged 18 or over. We don’t knowingly collect data from anyone younger and delete it
        if we find out.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        If we make an important change we’ll tell you by email or on the site before it takes effect. The date at
        the top shows when this policy last changed.
      </p>
    </LegalLayout>
  )
}

function TermsOfUse() {
  return (
    <LegalLayout
      title="Terms of use"
      intro={`These terms are the agreement between you and ${LEGAL.company} when you use MatchMeHub. Please read them: by creating an account you accept them. Our privacy policy explains how we handle your personal data.`}
    >
      <h2>1. Who can use MatchMeHub</h2>
      <p>You may use MatchMeHub only if you:</p>
      <ul>
        <li>are at least 18 years old;</li>
        <li>are legally able to enter into a relationship and this agreement;</li>
        <li>are honest about your relationship status;</li>
        <li>haven’t been convicted of a violent or sexual offence; and</li>
        <li>haven’t previously been removed from MatchMeHub.</li>
      </ul>

      <h2>2. Your account</h2>
      <p>
        Keep your password private; you’re responsible for what happens in your account. Everything in your profile
        must be true and about you, and your photos must be of you and recent. One person, one account.
      </p>

      <h2>3. How MatchMeHub works</h2>
      <p>
        You tell us about yourself and who you’re looking for. A MatchMeHub matchmaker reviews your request and proposes
        people for you to accept or decline. If you accept someone, we ask whether they’re interested too. You can
        also ask to be matched with a member from the Featured page. Matchmakers use their judgement: we can’t
        promise a particular number of proposals, a match, or that any relationship will work out.
      </p>

      <h2>4. Fees</h2>
      <p>
        Creating an account, sending requests and reviewing proposals is free. You pay a fee of {formatFee()} only
        when a match is mutual — when you and the other person have both said yes — and you choose to confirm it.
        The price is shown before you pay. [REFUND POLICY — e.g. “Because the fee pays for an introduction that has
        already been arranged, it isn’t refundable once your matchmaker has shared contact details, except where the
        law requires.”] Nothing in these terms affects your rights under consumer protection law.
      </p>

      <h2>5. How you must behave</h2>
      <p>You agree not to:</p>
      <ul>
        <li>harass, threaten, abuse, stalk or discriminate against anyone;</li>
        <li>ask anyone for money, gifts or financial information, or promote a business;</li>
        <li>share anyone else’s profile, photos or contact details outside MatchMeHub without their permission;</li>
        <li>pretend to be someone else or create fake accounts;</li>
        <li>post content that is sexually explicit, hateful, illegal, or that you don’t have the right to share;</li>
        <li>try to get around how MatchMeHub works, for example by scraping profiles or breaking its security.</li>
      </ul>

      <h2>6. Your content</h2>
      <p>
        You own what you post. You give us permission to store, display and share it in the ways the{' '}
        <LegalLink kind="privacy">privacy policy</LegalLink> describes, only to run MatchMeHub. That permission ends when
        you delete it or your account, apart from backups that are overwritten on schedule.
      </p>

      <h2>7. Featured profiles</h2>
      <p>
        If you choose to be featured, a limited card is visible to anyone on the internet. Turn it off at any time in
        your profile. We may remove a Featured card at our discretion.
      </p>

      <h2>8. Safety</h2>
      <p>
        We don’t run criminal background checks, and we can’t verify everything members tell us. You are responsible
        for your own safety when you contact or meet a match — please read our{' '}
        <LegalLink kind="safety">safety tips</LegalLink>. Report anything worrying to{' '}
        <Email to={LEGAL.safetyEmail} />.
      </p>

      <h2>9. Suspension and ending your account</h2>
      <p>
        You can delete your account at any time in My profile. We may suspend or remove an account that breaks these
        terms, puts others at risk or is required by law, and we’ll tell you why unless the law or someone’s safety
        prevents it.
      </p>

      <h2>10. Our responsibility to you</h2>
      <p>
        We provide MatchMeHub with reasonable care and skill. We aren’t responsible for how other members behave, on or
        off MatchMeHub, or for losses we couldn’t reasonably foresee. Where the law allows, our total liability to you is
        limited to the fees you paid us in the 12 months before the claim. Nothing here limits liability for death or
        personal injury caused by negligence, for fraud, or anything else the law doesn’t allow us to limit.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms to reflect changes to MatchMeHub or the law. We’ll give you notice of important changes;
        if you don’t agree you can delete your account before they take effect.
      </p>

      <h2>12. Law and disputes</h2>
      <p>
        These terms are governed by {LEGAL.governingLaw}. If you live in another country, you keep the protection of
        its mandatory consumer laws and may bring a claim in your local courts. Please contact us first at{' '}
        <Email to={LEGAL.supportEmail} /> — most problems can be solved quickly.
      </p>
    </LegalLayout>
  )
}

function CookieNotice() {
  return (
    <LegalLayout
      title="Cookie notice"
      intro="MatchMeHub uses only what it needs to keep you signed in and to save your progress. We don’t use advertising, analytics or tracking cookies, and we don’t let other companies place cookies on our site, so there’s nothing to accept or reject."
    >
      <h2>Cookies</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>What it does</th>
              <th>How long</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>mm_session</code>
              </td>
              <td>Keeps you signed in to your member account.</td>
              <td>30 days, or until you log out</td>
            </tr>
            <tr>
              <td>
                <code>mm_staff_session</code>
              </td>
              <td>Keeps a matchmaker signed in to the backoffice.</td>
              <td>30 days, or until they log out</td>
            </tr>
            <tr>
              <td>
                <code>mm_admin_session</code>
              </td>
              <td>Keeps an administrator signed in.</td>
              <td>30 days, or until they log out</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        These are “strictly necessary” cookies: MatchMeHub can’t work without them, so the law doesn’t require us to ask
        first. They can’t be read by scripts on the page and contain only a random code, not your details.
      </p>

      <h2>Storage in your browser</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>What it does</th>
              <th>How long</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>matchmehub.profileDraft</code>
              </td>
              <td>Saves the profile you’re filling in, so you don’t lose it if you close the page.</td>
              <td>Until you save your profile or log out</td>
            </tr>
            <tr>
              <td>
                <code>matchmehub.featuredPick</code>
              </td>
              <td>Remembers the Featured member you asked to meet while you create your account.</td>
              <td>Until your request is sent or you log out</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        These stay on your device and aren’t sent to us until you save. On a shared computer, log out when you’re done
        — that clears them. You can also clear them in your browser settings.
      </p>

      <h2>If this changes</h2>
      <p>
        If we ever add optional cookies, such as analytics, we’ll update this notice and ask for your permission
        before using them.
      </p>
    </LegalLayout>
  )
}

function SafetyAndConduct() {
  return (
    <LegalLayout
      title="Safety & conduct"
      intro="Our matchmakers introduce people thoughtfully, but you’re still meeting someone new. These tips help you stay safe, and the code of conduct below is what every MatchMeHub matchmaker agrees to."
    >
      <h2>Before you meet</h2>
      <ul>
        <li>Take your time. Talk on the phone or a video call before meeting in person.</li>
        <li>Don’t share your home address, workplace or financial details early on.</li>
        <li>
          <strong>Never send money</strong>, gift cards or bank details to someone you haven’t met, whatever the
          story. MatchMeHub staff will never ask you to pay outside our site.
        </li>
        <li>If something feels wrong, trust that feeling. You can stop at any time.</li>
      </ul>

      <h2>When you meet</h2>
      <ul>
        <li>Meet in a busy public place, and arrange your own transport there and back.</li>
        <li>Tell a friend or family member who you’re meeting, where and when.</li>
        <li>Keep your phone charged, and stay in control of your drinks and belongings.</li>
        <li>Leave whenever you want to. You don’t owe anyone an explanation.</li>
      </ul>

      <h2>Reporting a problem</h2>
      <p>
        Tell your matchmaker, or email <Email to={LEGAL.safetyEmail} />, if a match behaves inappropriately, asks you
        for money or isn’t who they said they were. We take every report seriously and may suspend or remove their
        account. <strong>If you’re in danger, contact the local emergency services first.</strong>
      </p>

      <h2 id="matchmaker-code">Matchmaker code of conduct</h2>
      <p>Everyone who matchmakes on MatchMeHub agrees to:</p>
      <ol>
        <li>
          <strong>Keep members’ information confidential.</strong> Use what members share only to find matches for
          them. Don’t download, screenshot, copy or discuss it outside MatchMeHub.
        </li>
        <li>
          <strong>Share a profile only with people you propose.</strong> Share contact details only after a match has
          been confirmed through MatchMeHub.
        </li>
        <li>
          <strong>Never contact members for personal reasons</strong>, and never date or pursue a member you look
          after.
        </li>
        <li>
          <strong>Never ask members for money</strong>, gifts or payment outside MatchMeHub.
        </li>
        <li>
          <strong>Treat every member with respect and without discrimination</strong>, and propose people honestly,
          based on what the member asked for.
        </li>
        <li>
          <strong>Report concerns.</strong> Tell the MatchMeHub team straight away about any safety worry, suspicious
          account or possible data leak.
        </li>
        <li>
          <strong>Use your own account only</strong>, keep your password private and log out on shared devices.
        </li>
      </ol>
      <p>
        Breaking this code can lead to your matchmaker account being suspended or removed, and may be reported to the
        authorities.
      </p>
    </LegalLayout>
  )
}
