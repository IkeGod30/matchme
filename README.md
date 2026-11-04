# MatchMe

Personal matchmaking: seekers describe the partner they want (including picture-based
physical preferences), a matchmaker proposes hand-picked people, and seekers pay only
once a match is mutual.

- **Web app**: React + TypeScript + Vite (`src/`)
- **API**: Node + Express + SQLite (`server/`), using Node's built-in `node:sqlite`

## Three kinds of users

- **Seekers** sign up freely, describe themselves and the partner they want, and accept or
  decline the matches proposed to them. They can also ask for a specific member from the Featured
  page ("Request a match with …"); the member is added to their open request (or opens one) and
  shown to the matchmaker at the top of the candidate list. Screens: `src/components/seeker/`,
  API: `server/routes/seeker.ts`.
- **Matchmakers** are back-office staff. They either apply publicly (footer → Become a matchmaker,
  `/#join` — hidden from signed-in seekers, who are shown the home page instead) or are invited by
  an existing matchmaker. Applying doesn't sign anyone in: the applicant sees a "we've received your
  application" page, and a super user approves or declines it; either way the applicant is emailed.
  Invited matchmakers are approved immediately. Matchmakers take on requests, propose matches, keep
  private team notes, browse all members and manage example photos.
  Screens: `src/components/matchmaker/`, API: `server/routes/matchmaker.ts`.
- **Super users** manage every account at **`/admin`**, which isn't linked from anywhere on the site:
  they review matchmaker applications, view seekers' profiles, suspend / reactivate, delete and send
  password resets to any account, and can make a matchmaker a super user too.
  Screens: `src/components/admin/`, API: `server/routes/admin.ts`.

The public site (landing, header, log-in / sign-up) is written for seekers. Matchmakers work in
the **backoffice** at `/matchmaker` (footer → Matchmaker log in; old `/#staff` links redirect
there), which has its own header, as does `/admin`.

Each is a **separate authentication realm**:

| | Public site (seekers) | Backoffice (matchmakers) | Admin (super users) |
|---|---|---|---|
| Address | `/` | `/matchmaker` | `/admin` |
| Log in / out / me | `/api/auth/login`, `/logout`, `/me` | `/api/auth/staff/login`, … | `/api/auth/admin/login`, … |
| Session cookie | `mm_session` | `mm_staff_session` | `mm_admin_session` |

An account only works in its own realm: a seeker account can't log in to the backoffice, a
matchmaker account can't log in to the public site, and neither can log in to `/admin`. A super
user promoted from a matchmaker gets a separate admin account with the same email, and chooses its
password from an emailed link. A suspended account can't log in anywhere and its sessions end at
once; a suspended seeker is also taken off the Featured page and out of matchmakers' candidate lists. Only one is signed in per browser, in both directions, and only on an explicit
action: clicking into the backoffice (Staff log in, Matchmaker log in, Apply) signs a seeker out
before the staff log-in, and "Sign out & go to site" signs staff out. Loading a page — a typed
URL, a reload, another tab — signs no one out; each area simply ignores the other realm's
session. The server enforces the rule on every log-in: starting a session in one realm (log-in,
sign-up, matchmaker invitation, password reset) ends the other realms' sessions. An email address is unique per realm, so the same person may have a seeker
account and a separate staff account. Password resets are per realm too.

Public pages (landing, featured members, login, matchmaker sign-up) are in `src/components/public/`;
pieces both sides use (pictures, cards, chips) are in `src/components/shared/`.

## Requirements

Node.js 22.18 or newer (the server runs TypeScript directly).

## Getting started

```sh
npm install
npm run seed      # sample members, demo requests and a matchmaker account
npm run dev       # API on :3001 + web app on http://localhost:5175 (opens in your browser)
```

`npm run seed` creates the first matchmaker and the first super user and prints their logins
once; invite more matchmakers from the dashboard's Team tab. To choose the logins yourself:

```powershell
$env:MATCHMAKER_EMAIL="you@example.com"; $env:MATCHMAKER_PASSWORD="a-long-password"
$env:ADMIN_EMAIL="owner@example.com"; $env:ADMIN_PASSWORD="another-long-password"
npm run seed -- --reset
```

For a database that already has data, `npm run create-admin` adds a super user (same
`ADMIN_EMAIL` / `ADMIN_PASSWORD` variables, otherwise `admin@matchme.local` with a generated
password printed once). More super users can then be promoted from `/admin`.

`--reset` wipes the database and uploaded photos (`server/data/`, git-ignored) first.

## Email (password reset)

"Forgot your password?" on the login page emails a one-time link that expires in 1 hour.
Without SMTP settings, emails are printed in the API console and saved to
`server/data/outbox/`, so you can open the link from there while developing.

To send real email, set these before starting the server:

| Variable | Example |
|---|---|
| `SMTP_HOST` | `smtp.sendgrid.net`, `smtp.gmail.com`, `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` (or `465` with `SMTP_SECURE=true`) |
| `SMTP_USER` / `SMTP_PASS` | Your provider's SMTP username and password / API key |
| `MAIL_FROM` | `MatchMe <hello@yourdomain.com>` |
| `APP_URL` | The site's public address, used in links (default `http://localhost:5175`) |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API (auto-restarts on change) and web app together |
| `npm run seed` | Adds sample data to an empty database (`-- --reset` to start over) |
| `npm run create-admin` | Adds a super user (`/admin`) to an existing database |
| `npm run build` | Type-checks app and server, builds the web app to `dist/` |
| `npm start` | Production: serves the API and the built app on one port (`PORT`, default 3001) |
| `npm run lint` | oxlint |

## How privacy is enforced

All rules live in the server (`server/data.ts`, `server/index.ts`):

- Seekers only receive their own profile, the people proposed to them, and seekers who
  accepted them as a match. Other members' preferences are never sent to seekers.
- Every seeker must give a **preferred contact** (phone call, WhatsApp, text message or email).
  Only the seeker and matchmakers ever receive it — it's stripped from members shown to other
  seekers and never on public cards. Matchmakers see it on the request, and a paid candidate's
  contact appears next to that match so they can arrange the introduction.
- Photos are served through `/api/photos/:id`, which applies the same rules. Seekers can add up
  to 6 photos (`profile_photos` table); the first is their main photo. The others
  (`/api/photos/:id/:photoId`) are never public, even on a public listing — only the member,
  matchmakers and people they're matched with can scroll through them.
- Profiles are private unless the member opts in to a public listing. Public cards only
  show photo, first name, age, city, job, bio and "looking for" message.
- The matchmaker role can see all members and requests; super users can see every account.

## Before going live

- **Payments** are a placeholder (`POST /api/seeker/proposals/:id/pay` records a test
  reference). Connect a provider such as Paystack or Stripe and verify payments server-side.
- **Demo photos** in `src/assets/demo-photos/` are placeholders for testing only.
- Run behind HTTPS (`NODE_ENV=production` marks the session cookie `Secure`), back up
  `server/data/`, and consider Postgres and object storage for photos as you grow.
