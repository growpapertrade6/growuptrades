-- ============================================================
-- PaperTrade schema
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- 1. PROFILES (extends auth.users with trading account state) -------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  trading_experience text default 'beginner',
  starting_cash numeric not null default 1000000,
  cash numeric not null default 1000000,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- 2. EQUITY POSITIONS -------------------------------------------------
create table if not exists public.positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol text not null,
  qty integer not null,
  avg_price numeric not null,
  side text not null check (side in ('BUY','SELL')),
  created_at timestamptz default now()
);

alter table public.positions enable row level security;

create policy "Users manage their own positions"
  on public.positions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. OPTION POSITIONS (NSE/BSE index + stock options) ------------------
create table if not exists public.option_positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  underlying text not null,
  exchange text not null check (exchange in ('NSE','BSE')),
  strike numeric not null,
  expiry date not null,
  option_type text not null check (option_type in ('CE','PE')),
  lots integer not null,
  lot_size integer not null,
  avg_premium numeric not null,
  side text not null check (side in ('BUY','SELL')),
  created_at timestamptz default now()
);

alter table public.option_positions enable row level security;

create policy "Users manage their own option positions"
  on public.option_positions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. ORDERS (unified equity + options trade history) --------------------
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  instrument_type text not null check (instrument_type in ('EQUITY','OPTION')),
  symbol text not null,
  exchange text not null default 'NSE',
  side text not null check (side in ('BUY','SELL')),
  qty integer not null,
  price numeric not null,
  order_type text not null default 'MARKET',
  strike numeric,
  expiry date,
  option_type text,
  realized_pnl numeric default 0,
  created_at timestamptz default now()
);

alter table public.orders enable row level security;

create policy "Users manage their own orders"
  on public.orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. WATCHLIST ------------------------------------------------------------
create table if not exists public.watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol text not null,
  created_at timestamptz default now(),
  unique (user_id, symbol)
);

alter table public.watchlist enable row level security;

create policy "Users manage their own watchlist"
  on public.watchlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. TRADE JOURNAL ----------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol text,
  title text not null,
  notes text,
  setup_tag text,
  emotion_tag text,
  created_at timestamptz default now()
);

alter table public.journal_entries enable row level security;

create policy "Users manage their own journal"
  on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. AUTO-CREATE PROFILE + DEFAULT WATCHLIST ON SIGNUP -----------------------
-- Fires whenever a new row appears in auth.users (i.e. right after sign up),
-- seeding ₹10,00,000 virtual cash and a starter watchlist automatically.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, cash, starting_cash)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 1000000, 1000000);

  insert into public.watchlist (user_id, symbol)
  values
    (new.id, 'RELIANCE'), (new.id, 'TCS'), (new.id, 'HDFCBANK'), (new.id, 'INFY'),
    (new.id, 'ICICIBANK'), (new.id, 'TATAMOTORS'), (new.id, 'SBIN'), (new.id, 'NIFTY50');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
