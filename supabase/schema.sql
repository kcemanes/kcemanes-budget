-- Budget tracker schema.
-- Run this in Supabase: SQL Editor > New query > paste > Run.
-- Written to be safe to re-run.

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  monthly_budget numeric(12, 2) check (monthly_budget is null or monthly_budget >= 0),
  created_at timestamptz not null default now(),

  -- One category name per user, and a target the composite FK below can point at.
  unique (user_id, name),
  unique (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  spent_on date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),

  -- Composite FK: an expense can only point at a category owned by the SAME
  -- user. Foreign keys are checked without RLS, so a plain FK on category_id
  -- alone would let a crafted request attach someone else's category id.
  constraint expenses_category_fkey
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on update cascade
    on delete restrict
);

create index if not exists expenses_user_spent_on_idx
  on public.expenses (user_id, spent_on desc);

create index if not exists expenses_user_category_idx
  on public.expenses (user_id, category_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: every row is private to the user that owns it.
-- Without this, the publishable key in the browser can read the whole table.
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "categories are private" on public.categories;
create policy "categories are private"
  on public.categories
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "expenses are private" on public.expenses;
create policy "expenses are private"
  on public.expenses
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
