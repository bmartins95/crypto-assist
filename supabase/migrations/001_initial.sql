-- Initial migration: profiles, ops, exit_prices, price_cache
-- Run in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)

-- ─── profiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  using (auth.uid() = id);

-- Automatically creates a profile row when a new user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── ops ─────────────────────────────────────────────────────────────────
create table public.ops (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  coin_id     text not null,       -- e.g. "bitcoin"
  symbol      text not null,       -- e.g. "BTC"
  name        text not null,       -- e.g. "Bitcoin"
  type        text not null check (type in ('Compra', 'Venda')),
  qty         numeric(30,10) not null,
  price       numeric(30,10) not null,
  fee         numeric(30,10) not null default 0,
  total       numeric(30,10) not null,
  platform    text not null default '',
  created_at  timestamptz default now()
);

alter table public.ops enable row level security;

create policy "own ops" on public.ops
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index ops_user_id_idx on public.ops(user_id);
create index ops_date_idx on public.ops(date);

-- ─── exit_prices ─────────────────────────────────────────────────────────
create table public.exit_prices (
  user_id     uuid not null references auth.users(id) on delete cascade,
  coin_id     text not null,
  exit_price  numeric(30,10) not null,
  updated_at  timestamptz default now(),
  primary key (user_id, coin_id)
);

alter table public.exit_prices enable row level security;

create policy "own exit_prices" on public.exit_prices
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── price_cache ─────────────────────────────────────────────────────────
create table public.price_cache (
  coin_id     text primary key,
  price_brl   numeric(30,10) not null,
  image_url   text,
  updated_at  timestamptz default now()
);

-- Read-only for authenticated users; only the server (service_role) writes,
-- since service_role bypasses RLS by default.
alter table public.price_cache enable row level security;

create policy "read price_cache" on public.price_cache
  for select
  to authenticated
  using (true);
