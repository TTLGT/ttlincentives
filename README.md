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

Every approved account — both admins, the staff viewers, and every broker —
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
JSON **outside the repo**, for example in `C:\keys\`.

Firebase gives the file a long name like
`ttl-incentives-firebase-adminsdk-fbsvc-8bc01913bb.json`. Either keep that name
and point the variable at it exactly, or rename the file — but make sure the two
match. **Pointing at a filename that doesn't exist is the easiest way to make
the seed fail**, and the error it produces is not obvious.

```powershell
# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\<exact-filename>.json"
```

```bash
# bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/<exact-filename>.json
```

The variable only lasts for that terminal window. Open a new one and you'll need
to set it again before re-seeding.

### Run it

```bash
npm install -D firebase-admin    # once
npm run seed:dry                 # prints the full plan, writes nothing
npm run seed                     # writes it
npm run seed -- --prune          # also deletes anyone no longer in the JSON
```

`--dry-run` prints every document it would write and a summary
(for example `2 admins, 27 viewers, 24 brokers`) before touching anything.
Start there.

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

## Import responses from the Google Form

Brokers submit through the **TTL Team 1 – Quotes Control Form**. The importer
reads the **Responses 2026** tab and turns each row into one validated
opportunity (+1).

```bash
npm run import:dry     # show what it would do, write nothing
npm run import         # do it
```

It also runs **automatically every 10 minutes** via
[`.github/workflows/import.yml`](.github/workflows/import.yml), so the
leaderboard is never more than about 15 minutes behind the form. The dashboard
listens to Firestore live, so when an import lands every open screen updates
itself — nobody has to refresh the page.

Importing this often is safe and free:

- The importer **writes nothing when nothing changed**. It reads the rows the
  sheet has, compares them against Firestore, and exits if they match.
- The **3:00 PM cut-off is a scoring rule**, not an import schedule. It is
  `DAILY_CUTOFF_HOUR` in [`src/config/competition.ts`](src/config/competition.ts)
  and is computed from each entry's own timestamp, so importing more often
  never moves anyone's score.
- The repo is public, so GitHub Actions minutes cost nothing.

### Update the board by hand

When a manager wants the board refreshed *right now* instead of waiting for the
next 10-minute run:

1. Open the repo's **Actions** tab.
2. Pick **Import form responses** in the left sidebar.
3. Click **Run workflow** (top right), leave the branch on `main`, and confirm.

It finishes in about a minute, and the board updates on its own once it does.
Runs are labelled **A mano** when a person started one and **Automatico** when
the schedule did, so it is obvious in the list who triggered what.

Tick **"Solo ver que haria"** before confirming to get a preview instead: the
run reports what it *would* import and writes nothing. Useful for checking a
suspicious row without touching the leaderboard.

> Managers need a GitHub account with write access to `TTLGT/ttlincentives` for
> the Run workflow button to appear. Add them under
> **Settings > Collaborators and teams**.

### What it reads, and what it refuses to read

The sheet contains client data. The importer names the only columns it is
allowed to touch, in `SAFE_COLUMNS`, and discards every other column the moment
the row is read.

| Column | Becomes |
|---|---|
| Timestamp | the entry's date |
| Email Address | which broker it belongs to |
| Load's Source | `source` — from a closed list |
| Broker Fee | `brokerFee` |
| Approved | `approved` when ticked, otherwise `pending` |
| Quote's Proof | **only whether the cell is empty** → `quoteSent` |

**Never read:** Client's Name, Client's Phone Number, Load Origin Address, Load
Destination Address, Load's Dimensions. **Never stored:** the Quote's Proof link
itself — only the true/false of whether one exists, which feeds the Phase 1
tie-breaker.

Free text is a leak risk, so `Load's Source` is reduced to the form's fixed list;
anything typed into "Other:" is stored as plain `Other` with the text dropped.
`Referral Provider` is skipped entirely — it holds people's names.

`src/lib/privacy.test.ts` enforces all of this, and the build fails if a future
edit tries to widen it.

### Re-running is safe

Each row gets a document id derived from its timestamp and the broker's email,
so importing twice updates rather than duplicates. On re-import only the
sheet-owned fields change (status, fee, quote-sent, source) — **points and admin
notes are left alone**, so a manual adjustment isn't overwritten.

### One-time setup

1. **Enable the Sheets API** —
   <https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=ttl-incentives>
2. **Share the sheet** with the service account as **Viewer**:
   `firebase-adminsdk-fbsvc@ttl-incentives.iam.gserviceaccount.com`
   (untick "Notify people" — it isn't a real mailbox)
3. **Set the sheet's timezone to Guatemala** — File → Settings → Time zone. The
   importer warns if it isn't, because responses near midnight would land on the
   wrong day.
4. **For the scheduled run**, add two repo secrets under
   Settings → Secrets and variables → Actions:
   - `FIREBASE_SERVICE_ACCOUNT` — the whole service account JSON
   - `SHEET_ID` — only if the sheet ever changes

### Things it does not do

- **Bonus points.** Every row is +1. Cold-call, referral, first-close and Big
  Fish bonuses need judgement, so an admin adds those in the panel.
- **Mark fees as collected.** An imported fee arrives as *pending*, because a
  quoted amount is not money in the bank and the $2,000 floor counts collected
  fees. An admin ticks it when payment is confirmed. To change that, flip
  `IMPORTED_FEE_IS_COLLECTED` in
  [`scripts/import-sheet.js`](scripts/import-sheet.js).
- **Invent brokers.** A response from an address that isn't on the roster is
  skipped and reported by email, never guessed.

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
