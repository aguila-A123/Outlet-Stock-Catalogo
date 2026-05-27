-- OUTLET STOCK - TABLA DE PERFILES DE CLIENTES
-- Ejecuta esto en Supabase > SQL Editor.
-- Si la tabla ya existe, este script no rompe nada importante.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  shipping_address text not null,
  city text not null,
  postal_code varchar(5) not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Si ya tienes la tabla creada pero no tenías postal_code:
alter table public.profiles add column if not exists postal_code varchar(5);
update public.profiles set postal_code = '00000' where postal_code is null;
alter table public.profiles alter column postal_code set not null;

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
