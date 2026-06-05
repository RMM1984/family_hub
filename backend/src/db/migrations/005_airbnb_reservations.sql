alter table if exists properties add column if not exists operation_type text;
alter table if exists properties add column if not exists rental_type text;
alter table if exists properties add column if not exists airbnb_enabled boolean default false;
alter table if exists properties add column if not exists airbnb_last_sync_at timestamptz;

update properties
set operation_type = case
  when type = 'airbnb' then 'tourist'
  when type = 'long_term' then 'long_term'
  when type = 'own_use' then 'own_use'
  when type = 'mixed' then 'mixed'
  else 'inactive'
end
where operation_type is null;

update properties set rental_type = operation_type where rental_type is null;
update properties set airbnb_enabled = true where coalesce(airbnb_ical_url, '') <> '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_operation_type_check') then
    alter table properties add constraint properties_operation_type_check check (operation_type in ('tourist','long_term','own_use','mixed','inactive'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_rental_type_check') then
    alter table properties add constraint properties_rental_type_check check (rental_type in ('tourist','long_term','own_use','mixed','inactive'));
  end if;
end $$;

create table if not exists property_reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  source text default 'airbnb',
  external_id text,
  title text,
  guest_name text,
  check_in date not null,
  check_out date not null,
  nights integer,
  status text default 'confirmed',
  imported_from_ical boolean default true,
  raw_ical jsonb default '{}',
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(property_id, source, external_id)
);

alter table if exists income add column if not exists reservation_id uuid references property_reservations(id);
alter table if exists income add column if not exists imported_from_airbnb boolean default false;
alter table if exists income add column if not exists amount_status text default 'missing';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'income_amount_status_check') then
    alter table income add constraint income_amount_status_check check (amount_status in ('missing','manual','estimated','confirmed'));
  end if;
end $$;

create index if not exists idx_property_reservations_property_id on property_reservations(property_id);
create index if not exists idx_property_reservations_check_in on property_reservations(check_in);
create index if not exists idx_income_reservation_id on income(reservation_id);
