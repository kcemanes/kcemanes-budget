# kcemanes-budget

A small personal budget tracker: log expenses by category, set a monthly
budget per category, and see where the month went. Each account only ever
sees its own data. Light/dark theme and the display currency are picked in
the header and remembered per browser.

It is an installable, offline-first app: it launches, reads and records
expenses with no connection, and syncs when one comes back. See
[Offline](#offline).

Live at **[budget.kcemanes.com](https://budget.kcemanes.com)**.

## Stack

- **React 19 + TypeScript**, built by **Vite**
- **Tailwind CSS v4** (via `@tailwindcss/vite`, no config file — theme tokens
  live in [src/index.css](src/index.css))
- **Supabase** for email/password auth and Postgres storage
- **IndexedDB** as the local source of truth, with a sync engine on top
- **vite-plugin-pwa** (Workbox) for the manifest and service worker
- **GitHub Pages** for hosting, deployed by GitHub Actions

## How it works

Everything runs in the browser and talks to Supabase directly — there is no
server of our own. Data is kept private by Postgres Row Level Security
rather than by application code, so the publishable key shipped in the
bundle can only reach the signed-in user's rows.

The screen never reads from Supabase, though. It reads from an IndexedDB
copy of the account, and a sync engine moves changes between that copy and
Postgres in the background — see [Offline](#offline).

| Path | Role |
| --- | --- |
| [src/App.tsx](src/App.tsx) | Session gate: loading → [Login](src/components/Login.tsx) → [Dashboard](src/components/Dashboard.tsx) |
| [src/hooks/useSession.ts](src/hooks/useSession.ts) | The signed-in account, resolved so that being offline never looks like being signed out |
| [src/hooks/useSyncState.ts](src/hooks/useSyncState.ts) | Subscribes the header to the sync engine's status and queue depth |
| [src/hooks/usePwa.ts](src/hooks/usePwa.ts) | Subscribes to "an update is waiting" and "the browser is offering an install" |
| [src/lib/supabase.ts](src/lib/supabase.ts) | The single Supabase client; fails loudly if env vars are missing |
| [src/lib/api.ts](src/lib/api.ts) | All reads and writes for categories and expenses — local, never networked |
| [src/lib/db.ts](src/lib/db.ts) | Opening IndexedDB, and reading or writing whole stores |
| [src/lib/store.ts](src/lib/store.ts) | Categories, expenses, and the outbox |
| [src/lib/sync.ts](src/lib/sync.ts) | The only module that talks to Supabase |
| [src/lib/auth.ts](src/lib/auth.ts) | Who is signed in, in a form that survives being offline |
| [src/lib/pwa.ts](src/lib/pwa.ts) | Service worker registration, update and install prompts |
| [src/lib/format.ts](src/lib/format.ts) | Date and month range helpers |
| [src/lib/theme.ts](src/lib/theme.ts) | Theme choice, storage, and the `data-theme` stamp |
| [src/lib/currency.ts](src/lib/currency.ts) | The currency list, money formatting, and storage |
| [src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx) | The light/dark button, used by both Login and Dashboard |
| [src/components/SyncStatus.tsx](src/components/SyncStatus.tsx) | The header pill: offline, syncing, or changes still queued |
| [src/components/UpdatePrompt.tsx](src/components/UpdatePrompt.tsx) | Offers a downloaded update rather than reloading unasked |
| [src/components/InstallButton.tsx](src/components/InstallButton.tsx) | Hands back the install prompt, on the browsers that defer one |
| [scripts/generate-icons.mjs](scripts/generate-icons.mjs) | Draws the install icons from the same geometry as the favicon |
| [supabase/schema.sql](supabase/schema.sql) | Tables, indexes, and RLS policies |

A few details worth knowing:

- The dashboard is scoped to one month at a time; expenses are fetched for
  that month's inclusive date range and the stepper can't move past the
  current month.
- A brand-new account has no categories, so a starter set (Groceries, Rent,
  Transport, Utilities, Dining out, Other) is seeded — but only once a sync
  has confirmed the server side is genuinely empty. Seeding on any empty
  read would re-seed on every cold offline start.
- `expenses` uses a **composite** foreign key on `(user_id, category_id)`.
  Foreign keys are checked without RLS, so a plain FK on `category_id`
  alone would let a crafted request attach another user's category.
- Amounts come back from `numeric()` as strings once large enough, so
  `listExpenses()` coerces them to numbers.

## Offline

The app installs to a home screen and works with no connection at all,
including a cold launch. Two independent pieces make that true.

**The shell** is precached by a service worker generated at build time by
vite-plugin-pwa, configured in [vite.config.ts](vite.config.ts). Supabase
requests are deliberately *not* cached: the data already lives in IndexedDB,
and an HTTP cache in front of the API would only be a second copy that
disagrees with it.

**The data** lives in IndexedDB, and it is the only thing the UI reads.
[src/lib/api.ts](src/lib/api.ts) — what the components call — never touches
the network, which is why the form behaves the same on a train as on wifi.

Where IndexedDB cannot be opened at all — a private window, storage blocked
by policy — [db.ts](src/lib/db.ts) quietly falls back to an in-memory copy
instead of failing. The app then behaves like the online-only version it used
to be: writes still work and still sync, they just do not outlive the tab.

### How a write works

Adding an expense writes it to IndexedDB and appends a change to the
**outbox**, an ordered log of what this device has done that Postgres has
not confirmed. The call returns as soon as that lands.

Row ids are generated by the client rather than by `gen_random_uuid()`.
That is the detail that makes offline writes work: the expense has its final
id the moment it is created, so nothing has to be re-pointed when it
eventually syncs, and the push can use `upsert` — a replay after a lost
response rewrites the same row instead of inserting a duplicate.

Deleting an expense that has not synced yet drops its queued create rather
than queueing a delete behind it, so a row the server has never seen is not
described to it twice.

### How a sync works

A pass is always **push, then pull**:

1. The outbox replays in `seq` order. Order matters: an expense cannot be
   inserted before the category it points at, because the composite foreign
   key would refuse it.
2. Every row for the account is fetched back and the local copy is replaced
   with it. Anything still in the outbox is layered on top, so an unsynced
   row does not flicker out mid-pass.

Pushing first is what lets the pull be treated as the truth, rather than
something that has to be merged field by field.

Passes run on load, on `online`, when the tab becomes visible, after every
local write, and on a 60-second timer as a backstop for a connection that
came back without announcing itself. Concurrent requests coalesce: a burst of
writes settles with one follow-up pass rather than one pass each.

There is deliberately no Background Sync registration — replaying a write
needs the Supabase session and its refresh logic, which live on the page, and
duplicating those in the worker would be a second, subtly different copy of
the auth code for a trigger only Chromium implements.

Pulls page through the results. PostgREST caps a response at 1000 rows and
says nothing about having done so, which would silently truncate a long
history.

### When the server says no

The two failure modes need opposite handling, and
[sync.ts](src/lib/sync.ts) tells them apart by status code:

- **Retryable** — no response at all, `401`/`403` (the token is likely
  mid-refresh), `408`, `429`, or any `5xx`. The change stays queued, and the
  pass stops there rather than skipping past it, because a later change may
  depend on it.
- **Refused** — anything else in the `4xx` range. It would be refused again
  forever, so it is dropped, and the pull that follows is what rolls the
  local row back. The dashboard then says what was undone.

One refusal is repaired instead of reported: two devices adding the same
category name while both offline. Names are unique per account, so the
second to arrive loses — but the expenses queued behind it are perfectly
good, so they are repointed at the category that won.

### What the header shows

A pill next to the account email appears only when there is something to
say — `Offline`, `Syncing…`, `Sync failed`, or a count of changes that have
not reached the server; the count combines with the first two, as
`Offline · 3 unsynced`. Nothing showing means everything is saved on both
sides.

### Signing out

Signing out erases this browser's copy of the account. That is the point
rather than a side effect: the local database is the account's full history,
and leaving it behind on a shared computer would outlive the session that
was supposed to protect it. Anything still queued goes with it, so the
button asks first when the outbox is not empty.

### Staying signed in without a network

Supabase refreshes its access token over the network, so a cold launch in
aeroplane mode can come back with no session at all — which, taken at face
value, would show the login form and hide data sitting in IndexedDB right
there. The account id and email are therefore remembered separately under
`budget.account` and treated as enough to keep rendering.

That identity grants nothing on its own; every queued write still has to
pass RLS with a real token before it reaches Postgres. Two cases are told
apart on purpose:

- The token **could not be checked** — the refresh call failed. `navigator.onLine`
  is not enough to detect this, because a captive portal or a dead uplink
  still reports being online. The remembered account stands.
- The session is **genuinely gone**, and Supabase said so without erroring.
  The login form comes back — and the outbox survives it, because only an
  explicit sign-out clears local data.

### Installing

Chromium fires `beforeinstallprompt` when the app qualifies, and
[pwa.ts](src/lib/pwa.ts) holds on to that event so
[InstallButton](src/components/InstallButton.tsx) can hand it back when the
header button is clicked. The event is `preventDefault`ed, or the browser
would show its own bar instead of letting the header do it; it is also
single-use, so the button disappears once it has been spent, accepted or not.

Safari and Firefox never fire it and install from their own menus, so the
button simply never appears there. iOS additionally ignores the manifest for
the app title, the status bar, and the home-screen icon, which is why
[index.html](index.html) carries the `apple-mobile-web-app-*` tags and an
`apple-touch-icon` next to it.

### Updates

A new build is never applied silently. This is a form people type into, and
reloading underneath them would discard what they were writing, so
[UpdatePrompt](src/components/UpdatePrompt.tsx) offers the reload instead
(`registerType: 'prompt'`). Declining costs nothing; the next launch picks
it up anyway.

### Icons

The manifest needs PNGs and the mark is only four shapes, so
[scripts/generate-icons.mjs](scripts/generate-icons.mjs) draws them and
encodes the PNGs directly rather than adding a rasteriser and a native build
step to CI. The output is committed. Re-run `npm run icons` after editing
[public/favicon.svg](public/favicon.svg) — the geometry is duplicated in
both files, **so change them together**.

The maskable icon insets the mark to 60%, because Android crops adaptive
icons to a shape of its choosing and only guarantees the middle 80%.

## Theme and currency

Both are display-only settings held in React context by
[src/App.tsx](src/App.tsx) and remembered in `localStorage`. They are per
browser, not per account — nothing about them is stored in Supabase, and
every read and write is wrapped in `try`/`catch` so a browser with storage
blocked still renders.

### Dark mode

The palette is two sets of CSS custom properties in
[src/index.css](src/index.css), swapped by a `data-theme` attribute on
`<html>`. Tailwind's `dark:` variant is repointed at the same attribute
(`@custom-variant dark`) so utilities and tokens can never disagree.

The choice is `system`, `light`, or `dark`, defaulting to `system`, which
follows the OS and keeps following it — `watchSystemTheme()` listens for
`prefers-color-scheme` changes, so a flip mid-session repaints without a
reload. The toggle in the header reads the *resolved* theme and offers the
opposite, so the first click always moves away from what is on screen.

An inline script in [index.html](index.html) stamps `data-theme` before the
first paint; without it, every load would flash one frame of the light
palette. It also sets the `theme-color` meta tag, which is what tints the
title bar of the installed app — CSS cannot reach that, so `applyTheme()`
keeps it in step on every later change. The script duplicates a little of
`theme.ts` on purpose — the storage key `budget.theme`, the attribute, and
the two bar colours are shared, **so change both together**.

### Currency

Amounts are stored as plain numbers with no currency attached, so switching
currency **relabels the existing figures rather than converting them** —
there are no exchange rates involved. `formatMoney()` comes from context, and
`Intl.NumberFormat` instances are cached per currency.

To add one, append an entry to `CURRENCIES` in
[src/lib/currency.ts](src/lib/currency.ts) with its code, the label shown in
the header picker, and a locale for the number format; the `CurrencyCode`
type and the picker's options both derive from that array. `DEFAULT_CURRENCY`
in the same file is what a browser with nothing remembered gets.

## Setup

Requires Node 22+.

```bash
npm install
```

### Supabase project

1. Create a Supabase project.
2. Open **SQL Editor > New query**, paste [supabase/schema.sql](supabase/schema.sql),
   and run it. It is safe to re-run.
3. Under **Authentication > Providers**, keep Email enabled. Sign-up with
   email confirmation on means new accounts see a "check your inbox"
   notice before their first session.

### Environment

Create `.env.local` in the repo root:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Both are read from **Project Settings > API**. Use the *publishable*
(anon) key only — it is inlined into the public bundle at build time. The
secret/service-role key must never appear here.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally — the only way to exercise the service worker |
| `npm run icons` | Redraw the install icons from the favicon geometry |
| `npm run lint` | ESLint over the repo |

## Deploying

Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml),
which builds and publishes `dist/` to GitHub Pages.

Because Vite inlines env vars at build time, the two `VITE_*` values must
also exist in the repo under **Settings > Secrets and variables > Actions**
(repository scope, not an environment). Either the Variables or the Secrets
tab works. The workflow checks both are non-empty and fails with a clear
error before building if not.

The service worker is built alongside the bundle and needs no extra step,
but two things about it are worth knowing. Its scope is the site root, which
works because the app is served from the domain root. And a returning visitor
gets the new build one launch late by design: the worker downloads it in the
background, and the update prompt hands it over when they say so.

`npm run dev` does not register a worker, so anything about offline
behaviour has to be checked against `npm run build && npm run preview`.

The custom domain comes from [public/CNAME](public/CNAME), which is why
Vite's `base` stays `'/'` — see [vite.config.ts](vite.config.ts). Changing
to a project subpath (`user.github.io/repo/`) would require setting `base`
to match.

## Changing the date locale

Dates are the one format not chosen at runtime:
[src/lib/format.ts](src/lib/format.ts) has a single `LOCALE` constant at the
top, and editing it changes every formatted date in the app. Money is
independent of it — see [Currency](#currency) above.
