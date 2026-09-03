# kcemanes-budget

A small personal budget tracker: log expenses by category, set a monthly
budget per category, and see where the month went. Each account only ever
sees its own data.

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
| [src/lib/format.ts](src/lib/format.ts) | Currency, dates, and month range helpers |
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

## Changing the currency

[src/lib/format.ts](src/lib/format.ts) has `LOCALE` and `CURRENCY`
constants at the top. Editing those two changes every formatted amount and
date in the app.
