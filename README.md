# kcemanes-budget

A small personal budget tracker: log expenses by category, set a monthly
budget per category, and see where the month went. Each account only ever
sees its own data. Light/dark theme and the display currency are picked in
the header and remembered per browser.

Live at **[budget.kcemanes.com](https://budget.kcemanes.com)**.

## Stack

- **React 19 + TypeScript**, built by **Vite**
- **Tailwind CSS v4** (via `@tailwindcss/vite`, no config file — theme tokens
  live in [src/index.css](src/index.css))
- **Supabase** for email/password auth and Postgres storage
- **GitHub Pages** for hosting, deployed by GitHub Actions

## How it works

Everything runs in the browser and talks to Supabase directly — there is no
server of our own. Data is kept private by Postgres Row Level Security
rather than by application code, so the publishable key shipped in the
bundle can only reach the signed-in user's rows.

| Path | Role |
| --- | --- |
| [src/App.tsx](src/App.tsx) | Session gate: loading → [Login](src/components/Login.tsx) → [Dashboard](src/components/Dashboard.tsx) |
| [src/hooks/useSession.ts](src/hooks/useSession.ts) | Current Supabase session, kept in sync with auth changes |
| [src/lib/supabase.ts](src/lib/supabase.ts) | The single Supabase client; fails loudly if env vars are missing |
| [src/lib/api.ts](src/lib/api.ts) | All reads and writes for categories and expenses |
| [src/lib/format.ts](src/lib/format.ts) | Date and month range helpers |
| [src/lib/theme.ts](src/lib/theme.ts) | Theme choice, storage, and the `data-theme` stamp |
| [src/lib/currency.ts](src/lib/currency.ts) | The currency list, money formatting, and storage |
| [src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx) | The light/dark button, used by both Login and Dashboard |
| [supabase/schema.sql](supabase/schema.sql) | Tables, indexes, and RLS policies |

A few details worth knowing:

- The dashboard is scoped to one month at a time; expenses are fetched for
  that month's inclusive date range and the stepper can't move past the
  current month.
- A brand-new account has no categories, so the first
  `listCategories()` seeds a starter set (Groceries, Rent, Transport,
  Utilities, Dining out, Other) and re-reads.
- `expenses` uses a **composite** foreign key on `(user_id, category_id)`.
  Foreign keys are checked without RLS, so a plain FK on `category_id`
  alone would let a crafted request attach another user's category.
- Amounts come back from `numeric()` as strings once large enough, so
  `listExpenses()` coerces them to numbers.

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
palette. It duplicates a little of `theme.ts` on purpose — the storage key
`budget.theme` and the attribute are shared, **so change both together**.

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
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint over the repo |

## Deploying

Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml),
which builds and publishes `dist/` to GitHub Pages.

Because Vite inlines env vars at build time, the two `VITE_*` values must
also exist in the repo under **Settings > Secrets and variables > Actions**
(repository scope, not an environment). Either the Variables or the Secrets
tab works. The workflow checks both are non-empty and fails with a clear
error before building if not.

The custom domain comes from [public/CNAME](public/CNAME), which is why
Vite's `base` stays `'/'` — see [vite.config.ts](vite.config.ts). Changing
to a project subpath (`user.github.io/repo/`) would require setting `base`
to match.

## Changing the date locale

Dates are the one format not chosen at runtime:
[src/lib/format.ts](src/lib/format.ts) has a single `LOCALE` constant at the
top, and editing it changes every formatted date in the app. Money is
independent of it — see [Currency](#currency) above.
