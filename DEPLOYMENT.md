# Deploying MatchMeHub to Vercel + Turso

How MatchMeHub runs in production, and the step-by-step move from the local database without
losing any data.

## How it runs

| Part | Locally (`npm run dev`) | On Vercel |
|---|---|---|
| Web app | Vite dev server | Static files (`dist/`) |
| API | Express on port 3001 | The same Express app, bundled into one Vercel Function (`/api/*`) |
| Database | `server/data/matchmehub.db` (SQLite file) | Turso (hosted libSQL, same SQLite format) |
| Photos | `server/data/uploads/` | Vercel Blob, a **private** store, served only through the access-checked `/api/photos/*` routes |
| Email | printed + saved to `server/data/outbox/` | SMTP (required) |
| Schema upgrades | when the dev server starts | once per deploy (`npm run vercel-build` runs `npm run migrate`) |

`npm run vercel-build` builds everything into `.vercel/output` (Vercel's Build Output format):
see `scripts/build-vercel.ts`. Routing: `/api/*` goes to the function, real files are served as
they are, and every other path (`/`, `/matchmaker`, `/admin`, …) gets the app's `index.html`.

### Data scripts

All of them use the local database unless `--target staging` / `--target production` is added.
Then they read the settings downloaded from Vercel (`.env.staging` / `.env.production`) plus your
own `.env.staging.local` / `.env.production.local` for values Vercel won't download — see
**Settings for the local scripts** below. Each run starts by printing which database and Blob store
it is using. Note the `--` before the options.

| Command | What it does |
|---|---|
| `npm run backup-local` | Checkpoints the local DB, copies `server/data/` to `server/data-backup-<time>/`, writes `migration/baseline-<time>.json` |
| `npm run migrate -- --target staging` | Creates/upgrades the schema (safe to repeat) |
| `npm run copy-db -- --target staging --from <backup>/matchmehub.db` | Copies every row into an **empty** hosted DB, in one all-or-nothing transaction |
| `npm run import-photos -- --target staging --from <backup>/uploads` | Uploads photos to Blob, keeping their names (safe to repeat) |
| `npm run manifest -- --target staging --out migration/staging.json` | Fingerprints the hosted DB and photos |
| `npm run verify-migration -- <baseline>.json migration/staging.json` | Fails unless every row and photo is identical |
| `npm run race-test -- --target staging` | Checks the once-only actions under 10 simultaneous requests; cleans up after itself. Never on production |
| `npm run import-photos -- --target production --download --to restored-uploads` | Rollback: downloads every photo |

---

## Step-by-step move

### Phase 0 — Protect the local data

1. Stop the dev server (Ctrl+C in its terminal).
2. Run `npm run backup-local`. Note the three paths it prints (database, photos, baseline).
3. Copy the new `server/data-backup-…` folder somewhere outside the project too (OneDrive, a USB drive).

### Phase 1 — Accounts and settings (once)

**Turso** (the database), at [app.turso.tech](https://app.turso.tech):
1. Sign up (GitHub sign-in works). The free plan is enough to start.
2. **Create Database** → name `matchmehub-staging`, location **close to Vercel's region**
   (for Vercel's default `iad1` — Washington, D.C. — choose AWS US East / Virginia).
3. Create a second one: `matchmehub-prod`, same location.
4. For each database: open it → **Connect** (or **Create Token**) → copy the **URL**
   (`libsql://…`) and create a **read & write token** that doesn't expire. Keep both safely.

**Vercel** (hosting), at [vercel.com](https://vercel.com):
1. **Add New → Project** → import the GitHub repository.
2. **Framework Preset: Other**. Leave the build command, output directory and install command as
   they are (`vercel.json` sets the build command; the output goes to `.vercel/output`).
3. Settings → **General → Node.js Version: 24.x**. Settings → **Functions → Region**: the one
   next to your Turso databases (default `iad1`).
4. **Storage → Create → Blob**: name `matchmehub-prod`, access **Private**. Connect it to the
   project with **Production** ticked only (Vercel ticks every environment by default — untick
   Preview and Development). Then create `matchmehub-staging` (Private) and connect it with
   **Preview** and **Development** only, no prefix. Connecting adds `BLOB_STORE_ID` to those
   environments; deployments sign in to the store automatically.
   - If Vercel says *"This project already uses BLOB_STORE_ID in Production or Preview. Set a
     prefix"*, the prod store is still connected to Preview: Storage → `matchmehub-prod` →
     Projects → edit (or disconnect and reconnect) so only Production is ticked, then try again.
   - Check: Settings → Environment Variables, search `BLOB` — `BLOB_STORE_ID` is listed twice,
     once for Production and once for Preview, with different values.
5. Upgrade the team to **Pro** before launch: the free Hobby plan is for non-commercial use only.

**Email (SMTP)**: create an account with Resend, Brevo or SendGrid, add your domain and the DNS
records it gives you (SPF/DKIM), and create SMTP credentials.

**Environment variables** — Vercel → Settings → Environment Variables. Add each one for
**Production** with production values, and again for **Preview** with staging values:

| Name | Production | Preview |
|---|---|---|
| `TURSO_DATABASE_URL` | `matchmehub-prod` URL | `matchmehub-staging` URL |
| `TURSO_AUTH_TOKEN` | prod token | staging token |
| `APP_URL` | `https://your-domain` | your staging/preview address |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | from the email provider | same (or a test account) |
| `CRON_SECRET` | a long random string | another one |

Each variable needs two separate entries — one ticked for Production, one for Preview — never one
entry ticked for both. Mark the tokens and passwords **Sensitive**. `BLOB_STORE_ID` was added when
you connected the stores. **Don't** add `NODE_ENV`: Vercel sets it, and setting it to `production`
yourself stops the build tools from being installed.

#### Settings for the local scripts

The data scripts run on your PC, so they need the same settings. In a terminal in the project folder:

1. Link the folder to the Vercel project (once): `npx vercel link` → log in → your team →
   *Link to existing project?* **y** → the MatchMeHub project.
2. Download the settings (again whenever they change, and when the Blob sign-in has expired):
   ```powershell
   npx vercel env pull .env.staging --environment=preview
   npx vercel env pull .env.production --environment=production
   ```
   These files are rewritten on every download — don't edit them.
3. Vercel doesn't download **Sensitive** values; it writes `[SENSITIVE]` instead (and says
   *"Secret values cannot be pulled"*). Put the real values in your own files, which Vercel never
   touches — `.env.staging.local` and `.env.production.local` in the project folder
   (see [.env.example](.env.example)):
   ```
   TURSO_DATABASE_URL=libsql://matchmehub-staging-<your-org>.turso.io
   TURSO_AUTH_TOKEN=<token from the Turso dashboard>
   ```
4. Check: `npm run migrate -- --target staging` first prints
   `[staging] database matchmehub-staging-… · Blob store store_…`. If something is missing it says
   what and where to put it.

The downloaded `VERCEL_OIDC_TOKEN` is the scripts' sign-in to the Blob store and lasts about 12
hours; when it has expired the scripts say so — run the `env pull` command again. All these
files are git-ignored; never share them.

### Phase 2 — Staging rehearsal (with a copy of the real data)

Replace `<backup>` and `<baseline>` with the paths `npm run backup-local` printed.

```powershell
npm run copy-db -- --target staging --from <backup>/matchmehub.db
npm run import-photos -- --target staging --from <backup>/uploads
npm run manifest -- --target staging --out migration/staging.json
npm run verify-migration -- <baseline> migration/staging.json      # must say PASSED
npm run race-test -- --target staging                              # must say 0 failed
```

Then push the `deploy/vercel-turso` branch to GitHub: Vercel builds a **Preview** deployment on
the staging database. On its address, go through the checklist below.

### Phase 3 — Production cutover

1. Stop the local app for good — from now on the local database must not change.
2. `npm run backup-local` again. This final backup and baseline are the source of truth.
3. Copy and verify, as on staging but with `--target production` and the new paths:
   ```powershell
   npm run copy-db -- --target production --from <backup>/matchmehub.db
   npm run import-photos -- --target production --from <backup>/uploads
   npm run manifest -- --target production --out migration/production.json
   npm run verify-migration -- <baseline> migration/production.json   # must say PASSED
   ```
   Don't go on unless it says PASSED.
4. Merge `deploy/vercel-turso` into `main` and push. Vercel deploys Production.
5. Settings → Domains: add your domain, and make sure `APP_URL` matches it (redeploy if you change it).
6. Smoke test on the live site: log in with an existing account in each area (`/`, `/matchmaker`,
   `/admin`), open an existing member's photos, sign up a new test seeker and delete it again,
   and request a password reset email.
7. Keep the final backup for at least 90 days.

### Checklist (staging preview, then the short version on production)

- **Public**: home page, Featured (signed out; signed in, filtered by gender), privacy and legal pages, phone layout.
- **Seeker**: sign up, log out/in, forgot + reset password (email arrives; using the link twice is refused); profile with 6 photos, reorder, remove; visibility; several requests; request a featured member; answer a proposal, pay, ask for more, close; delete the account.
- **Matchmaker**: apply (super users get an email); invitation link (works once); assign, notes, propose, record interest, close; edit profile with photo; member directory; example photos.
- **Super user**: approve and decline applications (applicant emailed), suspend (signed out at once, gone from Featured), reactivate, password reset, promote, delete.
- **Addresses**: reloading `/matchmaker` and `/admin` works; the session cookies are `Secure` and `HttpOnly` (browser dev tools → Application → Cookies).
- **Privacy**: a member's extra photos aren't visible to a stranger, only to matched members.
- **Logs**: Vercel → the deployment → Logs show no errors.

## Rollback

- **Code**: Vercel → Deployments → pick an earlier one → **Promote to Production**.
- **Back to running locally**: the code still runs on the local file and folder — `npm run dev` /
  `npm start` as before.
- **Data out of Turso**: Turso's dashboard can restore a database to an earlier point in time, and
  the Turso CLI can dump it (`turso db shell matchmehub-prod .dump > dump.sql`). Photos:
  `npm run import-photos -- --target production --download --to restored-uploads`.

## After launch

- **Backups**: Turso keeps a point-in-time restore window (longer on paid plans). For extra safety,
  run `npm run manifest` and a dump regularly.
- **Clean-up job**: Vercel runs `/api/internal/cleanup` daily at 03:00 UTC (expired sessions,
  reset links and rate-limit entries). Check it's listed under Settings → Cron Jobs.
- **Rate limiting**: the API limits failed log-ins per IP (in the database). Optionally add a
  Vercel Firewall rate-limit rule for `/api/auth/*` too.
- **Still placeholders**: payments (`POST /api/seeker/proposals/:id/pay`) and the legal/privacy
  page texts must be replaced before real members use the site.
