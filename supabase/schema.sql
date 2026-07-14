-- =====================================================================
-- Carsset – databázové schéma (spusť celé v Supabase → SQL Editor → Run)
-- Zabezpečení: RLS zapnuté na všech tabulkách i storage,
-- přístup má POUZE přihlášený uživatel (celá půjčovna sdílí jeden účet/účty).
-- =====================================================================

-- ---------- Tabulky ----------
create table if not exists public.cars (
  id text primary key,
  name text not null,
  type text not null check (type in ('osobni','dodavka')),
  prices jsonb not null,
  deposit int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  identifier text primary key,
  first_name text,
  last_name text,
  email text,
  phone text,
  last_used timestamptz not null default now(),
  count int not null default 1
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  created_at timestamptz not null default now(),
  car_id text,
  car_name text not null,
  car_type text not null,
  price int not null,
  deposit int not null default 0,
  deposit_paid boolean not null default false,
  antiradar boolean not null default false,
  rental_start text not null,
  rental_end text not null,
  customer jsonb not null,
  signature text,
  returned boolean not null default false,
  returned_at timestamptz,
  email_sent_to jsonb,
  pdf_path text,
  photos jsonb not null default '[]'::jsonb
);

create index if not exists contracts_created_idx on public.contracts (created_at desc);
create index if not exists contracts_car_idx on public.contracts (car_id);

-- skrytá / neaktuální vozidla (id přednastaveného i vlastního auta)
create table if not exists public.hidden_cars (
  car_id text primary key
);

-- ---------- RLS (jen přihlášení) ----------
alter table public.hidden_cars enable row level security;
drop policy if exists "auth all" on public.hidden_cars;
create policy "auth all" on public.hidden_cars for all to authenticated using (true) with check (true);

alter table public.cars enable row level security;
alter table public.clients enable row level security;
alter table public.contracts enable row level security;

drop policy if exists "auth all" on public.cars;
drop policy if exists "auth all" on public.clients;
drop policy if exists "auth all" on public.contracts;

create policy "auth all" on public.cars      for all to authenticated using (true) with check (true);
create policy "auth all" on public.clients   for all to authenticated using (true) with check (true);
create policy "auth all" on public.contracts for all to authenticated using (true) with check (true);

-- ---------- Storage bucket na PDF a fotky (PRIVÁTNÍ) ----------
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

drop policy if exists "contracts read"   on storage.objects;
drop policy if exists "contracts insert" on storage.objects;
drop policy if exists "contracts update" on storage.objects;
drop policy if exists "contracts delete" on storage.objects;

create policy "contracts read"   on storage.objects for select to authenticated using (bucket_id = 'contracts');
create policy "contracts insert" on storage.objects for insert to authenticated with check (bucket_id = 'contracts');
create policy "contracts update" on storage.objects for update to authenticated using (bucket_id = 'contracts');
create policy "contracts delete" on storage.objects for delete to authenticated using (bucket_id = 'contracts');
