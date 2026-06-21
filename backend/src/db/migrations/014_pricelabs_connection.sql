create table if not exists pricelabs_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pricelabs',
  encrypted_api_key text,
  is_active boolean default true,
  connected_by uuid,
  connected_at timestamptz default now(),
  last_tested_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb default '{}'
);

create unique index if not exists idx_pricelabs_connections_provider
  on pricelabs_connections(provider)
  where is_active = true;

create table if not exists pricelabs_listings (
  id uuid primary key default gen_random_uuid(),
  pricelabs_listing_id text not null,
  pms text not null,
  listing_name text not null,
  latitude numeric,
  longitude numeric,
  country text,
  city_name text,
  state text,
  no_of_bedrooms numeric,
  channel_listing_details jsonb default '[]',
  raw_data jsonb default '{}',
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (pms, pricelabs_listing_id)
);

create table if not exists pricelabs_listing_mappings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  pricelabs_listing_id text not null,
  pms text not null,
  listing_name text not null,
  is_active boolean default true,
  mapped_at timestamptz default now(),
  metadata jsonb default '{}'
);

create unique index if not exists idx_pricelabs_mappings_active_property
  on pricelabs_listing_mappings(property_id)
  where is_active = true;

create unique index if not exists idx_pricelabs_mappings_active_listing
  on pricelabs_listing_mappings(pms, pricelabs_listing_id)
  where is_active = true;
