# Independence Sales Sprint — Leaderboard

Standings site for the broker sales competition at **Total Transport Logistics**,
September 2026.

The site is public on GitHub Pages. **The data is not.** Anyone who is not signed
in with an approved Google account sees a sign-in screen and nothing else — no
standings, no names, no photos.

- **Stack:** Vite + React + TypeScript, Tailwind CSS v4, Recharts, lucide-react
- **Backend:** Firebase Auth (Google) + Cloud Firestore
- **Hosting:** GitHub Pages, deployed by GitHub Actions on push to `main`
- **UI language:** Spanish. **Timezone:** America/Guatemala (UTC-6, no DST).

---

## No client information, anywhere

This site never stores, displays or transmits client names, phone numbers,
pickup or delivery addresses, load dimensions, or links to quote screenshots.
That data lives in the private Google Sheet and stays there.

It stores only: which broker, what day, what kind of point, how many points, the
broker fee amount, and an admin's note.

This is enforced in three places:

1. `src/types.ts` has no client field, and none may be added.
2. `sanitize()` in `src/context/DataContext.tsx` drops anything not in the model
   before it leaves the browser.
3. `firestore.rules` uses a **closed field list** (`keys().hasOnly([...])`). The
   server rejects any write carrying an extra field.

There is deliberately **no importer for the old Google Sheet**. That sheet holds
2023–2024 data from a different competition with different people, and it holds
client information we are not allowed to copy. The sprint starts fresh.

---

## Broker fees are visible to everyone signed in

Every approved account — both admins, the staff viewers, and all 25 brokers —
sees every broker's fee amounts and totals, on the leaderboard, in the charts and
on every broker page. This is deliberate and the team agreed to it. There is no
role check on fees and no toggle for it. Don't add one.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173/ttlincentives/
```

Other scripts:

```bash
npm run build        # typecheck + production build into dist/
npm test             # scoring engine tests (21 tests)
npm run test:watch
npm run seed:dry     # print what the seed script would write, write nothing
npm run seed         # actually write members + brokers to Firestore
```

Sign-in will not work until you fill in the Firebase config (next section). The
sign-in screen tells you so on screen.

---

## Set up the Firebase project

### 1. The project

The Firebase project is **`ttl-incentives`**, already created. The repo is
configured to point at it. This project is separate from `ttms-59aa5`, which is
not used here.

### 2. Create the Firestore database

1. Left sidebar: **Databases & Storage → Firestore → Create database**
2. Start in **production mode** (locked). The rules in this repo replace the
   defaults.
3. Pick a region close to Guatemala — `us-central1` or `nam5` is fine.

### 3. Turn on Google sign-in

1. Left sidebar: **Authentication → Sign-in method → Google → Enable**
2. Set a support email and save.

### 4. Authorize the domains

**Authentication → Settings → Authorized domains → Add domain.**

Add **`ttlgt.github.io`** — the host only, no path, no `https://`.
(The repo is `github.com/TTLGT/ttlincentives`, so the site lives at
<https://ttlgt.github.io/ttlincentives/>.) `localhost` is already there by default.

> **If you skip this, sign-in fails silently in production.** The popup opens and
> closes with nothing happening. If that happens, this is why. The site surfaces
> the `auth/unauthorized-domain` error when it can.

### 5. Copy the web config into the repo

**Project settings → Your apps → Web app (`</>`) → Register app**, then copy the
`firebaseConfig` values into `FALLBACK_CONFIG` in
[`src/lib/firebase.ts`](src/lib/firebase.ts).

This config (`apiKey` and friends) is **not a secret** — it ships in the bundle of
every Firebase site. It is safe to commit. The security rules are what protect
the data.

You can instead put them in a `.env.local` (gitignored) using `VITE_FIREBASE_*`
names; env vars win over the committed values.

**Never commit a service account JSON.** `.gitignore` already blocks the usual
filenames.

---

## Deploy the Firestore security rules

> ### Committing `firestore.rules` does not deploy it.
>
> The file sitting in this repo does nothing on its own. Until you run the
> command below, your database is running whatever rules are live in the
> console. **You have to run this yourself.**

```bash
npm install -g firebase-tools     # once
firebase login                    # once
firebase use --add                # pick ttl-incentives, alias it "default"
firebase deploy --only firestore:rules
```

Verify in the console under **Firestore Database → Rules** that the published
rules match the file, and check the "Last deployed" timestamp.

Re-run that deploy command **every time you edit `firestore.rules`.**

### What the rules do

| Collection | Read | Write |
|---|---|---|
| `members/{email}` | your own document only | nobody (seed script only) |
| `brokers/{id}` | anyone on the allowlist | nobody (seed script only) |
| `entries/{id}` | anyone on the allowlist, **fees included** | the two admin emails only |
| `comments/{id}` | anyone on the allowlist | the two admin emails only |
| anything else | nobody | nobody |

Admin emails are written literally into the rules so write access does not depend
on any document that could be altered. They must stay in sync across three files:

- `firestore.rules`
- `ADMIN_EMAILS` in `src/config/competition.ts`
- `admins` in `data/members.json`

The browser also checks the signed-in email, but that only decides what to paint.
**The rules are what actually protects the data.** Never rely on the browser
check alone.

---

## Seed the allowlist and the roster

The allowlist lives in [`data/members.json`](data/members.json) — plain JSON, the
source of truth for who gets in.

`members/` is **not writable from the browser by anyone**, so it is loaded with
the Admin SDK, which bypasses the rules.

### Get a service account key

**Project settings → Service accounts → Generate new private key.** Save the
JSON **outside the repo** (e.g. `C:\keys\ttl-incentives.json`).

```powershell
# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\ttl-incentives.json"
```

```bash
# bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/ttl-incentives.json
```

### Run it

```bash
npm install -D firebase-admin    # once
npm run seed:dry                 # prints the full plan, writes nothing
npm run seed                     # writes it
npm run seed -- --prune          # also deletes anyone no longer in the JSON
```

`--dry-run` prints every document it would write and a summary
(`2 admins, 28 viewers, 25 brokers`) before touching anything. Start there.

---

## Add or remove someone from the allowlist

1. Edit [`data/members.json`](data/members.json).
   - **Staff viewer:** add `{ "local": "name", "name": "Full Name" }` to
     `staffViewers`. Read-only access to everything.
   - **Broker:** add to `brokers` with a `local` (email prefix), an `id`
     (kebab-case of the full name) and the `name` in caps.
   - **Admin:** add to `admins` — and also to `ADMIN_EMAILS` in
     `src/config/competition.ts` **and** to the list in `firestore.rules`, then
     redeploy the rules.
2. `npm run seed:dry` and read the plan.
3. `npm run seed` (add `-- --prune` to remove people who were dropped from the
   JSON).
4. For a new broker, drop their photo into `photos-source/` and re-run the seed
   — see [Add photos](#add-photos).
5. Commit and push so the repo stays the source of truth.

Removing someone from `members/` locks them out immediately — the rules stop
returning any document to them.

---

## Add photos

Photos are stored **inside each broker's Firestore document**, not as files on
the website.

That is deliberate. This repo is public and GitHub Pages serves every published
file to anyone — no sign-in. A photo in `public/` could be downloaded by a
stranger who guessed the URL. Coming from Firestore, photos are protected by the
same rules that protect everything else: signed out, you get nothing.

### How to add them

1. Create a folder called **`photos-source/`** in the project root. It is
   gitignored, so nothing in it can reach the public repo.
2. From the Drive folder "📷 Fotos de Empleados", save each photo there named
   after the broker id, cropped square and resized to **400×400**:
   `alex-flores.jpg`, `alexis-garcia.jpg`, … (`.jpg`, `.png` and `.webp` all work).
   The ids are in [`data/members.json`](data/members.json).
3. Re-run the seed:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\<your-key>.json"
   npm run seed:dry     # shows which photos it found and how big they are
   npm run seed
   ```

They appear on the site immediately — no rebuild, no deploy.

### Good to know

- **Add them a few at a time.** A broker with no photo shows a navy circle with
  their initials. **The site looks finished with zero photos.**
- **Re-running the seed without `photos-source/` will not erase photos already
  uploaded.** The script only writes a photo when it actually finds a file.
- Keep each file under **700 KB** — a Firestore document maxes out at 1 MB. The
  seed refuses anything bigger and tells you which one. A 400×400 JPG is
  normally well under 100 KB.
- To replace someone's photo, overwrite the file and re-run the seed.

---

## Deploy the site

Push to `main`. The workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests,
builds, and publishes to GitHub Pages.

One-time setup: **repo Settings → Pages → Source → GitHub Actions**.

If the repo is not served at `/ttlincentives/` (custom domain, or a rename),
change `base` in [`vite.config.ts`](vite.config.ts).

The app uses `HashRouter`, so URLs look like `/#/broker/alex-flores`. That is
deliberate — GitHub Pages returns 404 for any path that is not a real file, so
hash routes are the only ones that survive a refresh or a shared link.

---

## How the code is laid out

```
src/
  config/competition.ts   All dates, prizes, thresholds and the open-question flags
  lib/
    scoring.ts            THE scoring engine — every screen and chart calls this
    scoring.test.ts       Tests for it
    dates.ts              Guatemala-time date handling
    palette.ts            Colorblind-safe chart palette
    firebase.ts           Firebase config and connection
    format.ts             Money, initials, percentages
  context/                Auth (session + role), Data (live Firestore), Theme (dark mode)
  hooks/useCompetition.ts The one hook every screen uses for its numbers
  components/             Layout, Avatar, Countdown, badges, charts/
  pages/                  Leaderboard, Charts, BrokerPage, Admin, Rules
data/members.json         The allowlist and the 25-broker roster
scripts/seed-members.js   Loads that JSON into Firestore
firestore.rules           Server-side access control (deploy it yourself)
```

### One scoring engine

All of the maths lives in [`src/lib/scoring.ts`](src/lib/scoring.ts). The phase-1
opportunity count and the phase-2 points both come out of `computeStandings()`,
and every screen and chart reads from it through
[`useCompetition()`](src/hooks/useCompetition.ts). Nothing recomputes a score on
its own, so the leaderboard, the charts and a broker's page cannot drift apart.

Only entries with status `approved` ever score. That decision lives in exactly
one function, `scores()`.

---

## Competition configuration

Everything tunable is in
[`src/config/competition.ts`](src/config/competition.ts):

| Setting | Value |
|---|---|
| Phase 1 (TOP HUNTER) | Sept 16 → Sept 23, 2026 — most validated opportunities, Q500 |
| Phase 2 (TOP SPRINT WINNER) | Sept 24 → Sept 30, 2026 — most points, Q500 |
| Big Fish | Sept 24 → Sept 30, fee over $500, +2 pts and Q50 |
| Qualification | $2,000 collected fee **and** 1 load per day |
| Daily cut-off | 3:00 PM Guatemala |

### Three rules Erwin confirmed

All three were open questions in the rules doc. They are settled, and each is a
single flag or constant in `src/config/competition.ts` if it ever changes:

1. **`BONUS_POINTS_COUNT_IN_PHASE1`** = `true` — phase 1 is always decided purely
   by opportunity count, and bonus points never affect that ranking. Bonuses
   earned Sept 16–23 *do* accumulate into the ongoing points leaderboard. Flip
   the one flag to make bonuses start only on Sept 24.
2. **`PHASE2_END`** = `2026-09-30` — same as the Big Fish window.
3. **`QUOTE_POINTS_HAVE_NO_DAILY_THRESHOLD`** = `true` — **every** new quote is
   worth +1, whether or not the broker already logged one that day. There is no
   daily minimum to clear before quotes start scoring; the first quote of the day
   scores the same as the fourth. Log one `extra_quote` entry per new quote.

   Don't confuse this with the **1-load-per-day minimum**, which is still in
   force — but that is a requirement to *qualify for the final prize*
   (`QUALIFY_LOADS_PER_DAY`), not a threshold for scoring quotes.

---

## A note on the roster

Two brokers have similar-looking accounts. They are different people:

| Email | Name | Broker id |
|---|---|---|
| `alex@` | ALEX FLORES | `alex-flores` |
| `alexis@` | ALEXIS GARCIA | `alexis-garcia` |

Don't merge or autocomplete one into the other when editing
[`data/members.json`](data/members.json).
