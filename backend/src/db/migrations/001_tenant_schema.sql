create extension if not exists pgcrypto;

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  address text,
  city text,
  zip text,
  type text check (type in ('airbnb','long_term','mixed','own_use')),
  initial_investment numeric,
  reform_cost numeric,
  purchase_date date,
  airbnb_url text,
  airbnb_ical_url text,
  capacity_guests integer,
  bedrooms integer,
  bathrooms integer,
  surface_m2 numeric,
  cover_image_url text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  category text check (category in ('electricity','water','internet','community','cleaning','ibi','garbage','home_insurance','liability_insurance','rental_insurance','maintenance','repairs','furniture','airbnb_commission','mortgage','other')),
  provider text,
  amount numeric not null,
  expense_date date not null,
  description text,
  is_recurring boolean default false,
  recurrence text check (recurrence in ('monthly','bimonthly','quarterly','yearly')),
  receipt_url text,
  shared_between uuid[] default '{}',
  created_at timestamptz default now()
);

create table if not exists income (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  source text check (source in ('airbnb','long_term_rent','other')),
  amount numeric,
  income_date date not null,
  description text,
  guest_name text,
  check_in date,
  check_out date,
  nights integer,
  airbnb_reservation_id text unique,
  imported_from_ical boolean default false,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  type text check (type in ('insurance','license','certificate','inspection','contract','warranty','deed','other')),
  subtype text,
  title text not null,
  provider text,
  policy_number text,
  issue_date date,
  expiration_date date,
  cost numeric,
  file_url text,
  details jsonb default '{}',
  notes text,
  alert_days_before integer default 60,
  alert_sent boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists document_history (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id),
  year integer,
  cost numeric,
  notes text,
  created_at timestamptz default now()
);

create table if not exists ical_sync_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid,
  synced_at timestamptz default now(),
  reservations_imported integer,
  errors text
);
