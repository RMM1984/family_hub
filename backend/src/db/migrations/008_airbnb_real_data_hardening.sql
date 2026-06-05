alter table if exists property_reservations add column if not exists guest_count integer;
alter table if exists property_reservations add column if not exists guest_count_status text default 'missing';
alter table if exists property_reservations add column if not exists amount_status text default 'missing';
alter table if exists property_reservations add column if not exists income_id uuid references income(id);
alter table if exists property_reservations add column if not exists source_method text default 'ical';
alter table if exists property_reservations add column if not exists data_origin text default 'airbnb_ical';
alter table if exists property_reservations add column if not exists is_demo boolean default false;
alter table if exists property_reservations add column if not exists raw_summary text;
alter table if exists property_reservations add column if not exists raw_description text;
alter table if exists property_reservations add column if not exists imported_at timestamptz default now();
alter table if exists property_reservations add column if not exists last_seen_at timestamptz default now();

alter table if exists income add column if not exists data_origin text default 'manual';
alter table if exists income add column if not exists is_demo boolean default false;
alter table if exists income add column if not exists source_method text;

create index if not exists idx_property_reservations_property_id on property_reservations(property_id);
create index if not exists idx_property_reservations_check_in on property_reservations(check_in);
create index if not exists idx_property_reservations_last_seen_at on property_reservations(last_seen_at);
create index if not exists idx_income_property_id on income(property_id);
create index if not exists idx_income_reservation_id on income(reservation_id);
create index if not exists idx_income_data_origin on income(data_origin);

update property_reservations
set source_method = coalesce(source_method, 'ical'),
    data_origin = coalesce(data_origin, 'airbnb_ical'),
    is_demo = coalesce(is_demo, false),
    amount_status = coalesce(amount_status, 'missing'),
    guest_count_status = case when guest_count is null then coalesce(guest_count_status, 'missing') else coalesce(guest_count_status, 'manual') end,
    raw_summary = coalesce(raw_summary, title),
    last_seen_at = coalesce(last_seen_at, synced_at, now()),
    imported_at = coalesce(imported_at, created_at, now());

update property_reservations
set guest_name = null
where source = 'airbnb'
  and lower(coalesce(guest_name, '')) in ('reserva', 'reserved', 'airbnb (not available)', 'not available');

update income
set is_demo = true,
    data_origin = 'demo_seed',
    source_method = coalesce(source_method, 'seed')
where source = 'airbnb'
  and reservation_id is null
  and coalesce(imported_from_airbnb, false) = false;

update income
set is_demo = false,
    data_origin = 'airbnb_ical',
    source_method = coalesce(source_method, 'ical'),
    amount_status = coalesce(amount_status, 'missing')
where source = 'airbnb'
  and reservation_id is not null;

update property_reservations pr
set income_id = i.id,
    amount_status = coalesce(i.amount_status, pr.amount_status, 'missing')
from income i
where i.property_id = pr.property_id
  and i.reservation_id = pr.id
  and pr.income_id is null;
