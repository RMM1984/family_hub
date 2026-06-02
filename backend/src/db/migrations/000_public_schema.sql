create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  schema_name text unique not null,
  plan text default 'basic',
  created_at timestamptz default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  email text unique not null,
  password_hash text not null,
  full_name text,
  role text default 'admin' check (role in ('admin','viewer')),
  active boolean default true,
  created_at timestamptz default now()
);
