alter table if exists income add column if not exists metadata jsonb default '{}';

create table if not exists airbnb_earnings_imports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  filename text,
  status text default 'pending_review',
  rows_total integer default 0,
  rows_matched integer default 0,
  rows_applied integer default 0,
  uploaded_by uuid,
  uploaded_at timestamptz default now(),
  metadata jsonb default '{}'
);

create table if not exists airbnb_earnings_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references airbnb_earnings_imports(id) on delete cascade,
  property_id uuid not null references properties(id),
  row_index integer not null,
  raw_data jsonb not null,
  reservation_id uuid references property_reservations(id),
  income_id uuid references income(id),
  match_status text default 'unmatched',
  match_confidence numeric,
  suggested_check_in date,
  suggested_check_out date,
  suggested_guest_name text,
  suggested_amount numeric,
  suggested_currency text default 'EUR',
  suggested_host_fee numeric,
  suggested_cleaning_fee numeric,
  suggested_taxes numeric,
  suggested_payout numeric,
  applied boolean default false,
  applied_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_airbnb_earnings_imports_property on airbnb_earnings_imports(property_id, uploaded_at desc);
create index if not exists idx_airbnb_earnings_import_rows_import on airbnb_earnings_import_rows(import_id);
create index if not exists idx_airbnb_earnings_import_rows_property on airbnb_earnings_import_rows(property_id);
create index if not exists idx_airbnb_earnings_import_rows_reservation on airbnb_earnings_import_rows(reservation_id);
