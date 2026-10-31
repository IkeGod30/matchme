# MatchMe

Personal matchmaking: seekers describe the partner they want (including picture-based
physical preferences), a matchmaker proposes hand-picked people, and seekers pay only
once a match is mutual.

- **Web app**: React + TypeScript + Vite (`src/`)
- **API**: Node + Express + SQLite (`server/`), using Node's built-in `node:sqlite`

## Two kinds of users

- **Seekers** sign up freely, describe themselves and the partner they want, and accept or
  decline the matches proposed to them. They can also ask for a specific member from the Featured
  page ("Request a match with …"); the member is added to their open request (or opens one) and
  shown to the matchmaker at the top of the candidate list. Screens: `src/components/seeker/`,
  API: `server/routes/seeker.ts`.
- **Matchmakers** either apply publicly (header → For matchmakers → Apply) or are invited by an
  existing matchmaker. Applicants can log in but see nothing until a matchmaker approves them in
  Dashboard → Team; invited matchmakers are approved immediately. They take on requests, propose
  matches, keep private team notes, browse all members and manage example photos.
  Screens: `src/components/matchmaker/`, API: `server/routes/matchmaker.ts`.

The landing page is written for seekers; matchmakers reach their side through **For matchmakers**
in the header (or the footer link). The log-in / sign-up form has a **Seeker | Matchmaker** toggle.

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

`npm run seed` creates the first matchmaker and prints their login once; invite more from the
dashboard's Team tab. To choose the first matchmaker's login yourself:

```powershell
$env:MATCHMAKER_EMAIL="you@example.com"; $env:MATCHMAKER_PASSWORD="a-long-password"; npm run seed -- --reset
```

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
| `npm run build` | Type-checks app and server, builds the web app to `dist/` |
| `npm start` | Production: serves the API and the built app on one port (`PORT`, default 3001) |
| `npm run lint` | oxlint |

## How privacy is enforced

All rules live in the server (`server/data.ts`, `server/index.ts`):

- Seekers only receive their own profile, the people proposed to them, and seekers who
  accepted them as a match. Other members' preferences are never sent to seekers.
- Photos are served through `/api/photos/:id`, which applies the same rules.
- Profiles are private unless the member opts in to a public listing. Public cards only
  show photo, first name, age, city, job, bio and "looking for" message.
- The matchmaker role can see all members and requests.

## Before going live

- **Payments** are a placeholder (`POST /api/seeker/proposals/:id/pay` records a test
  reference). Connect a provider such as Paystack or Stripe and verify payments server-side.
- **Demo photos** in `src/assets/demo-photos/` are placeholders for testing only.
- Run behind HTTPS (`NODE_ENV=production` marks the session cookie `Secure`), back up
  `server/data/`, and consider Postgres and object storage for photos as you grow.
