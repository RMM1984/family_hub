alter table if exists documents add column if not exists document_type text;
alter table if exists documents add column if not exists document_category text default 'essential';
alter table if exists documents add column if not exists valid_until date;

update documents
set document_type = case
  when document_type is not null then document_type
  when type in ('ibi') then 'ibi'
  when type in ('seguro','insurance') then 'home_insurance'
  when type in ('basuras','garbage','garbage_tax') then 'garbage_tax'
  when type in ('certificado','certificate','energy_certificate') then 'energy_certificate'
  when type in ('cedula','occupancy_certificate') then 'occupancy_certificate'
  when type in ('licencia','tourist_license') then 'tourist_license'
  else 'other_essential'
end;

update documents
set document_category = coalesce(document_category, 'essential'),
    valid_until = coalesce(valid_until, expiration_date);

alter table if exists documents drop constraint if exists documents_document_category_check;
alter table if exists documents add constraint documents_document_category_check
  check (document_category in ('essential','drive_inbox','operational_receipt','other'));

alter table if exists documents drop constraint if exists documents_document_type_check;
alter table if exists documents add constraint documents_document_type_check
  check (document_type is null or document_type in (
    'ibi','home_insurance','garbage_tax','energy_certificate','occupancy_certificate','tourist_license','other_essential',
    'factura','contrato','seguro','comunidad','certificado','garantia','manual','reserva','otro',
    'insurance','contract','certificate','warranty','license','inspection','other'
  ));

alter table if exists documents drop constraint if exists documents_type_check;
alter table if exists documents add constraint documents_type_check check (type in (
  'factura','contrato','seguro','ibi','comunidad','certificado','garantia','manual','mantenimiento','reserva','otro',
  'insurance','contract','certificate','warranty','license','inspection','other',
  'home_insurance','garbage_tax','energy_certificate','occupancy_certificate','tourist_license','other_essential'
));

create index if not exists idx_documents_property_category_date on documents(property_id, document_category, document_date);

alter table if exists documents drop constraint if exists documents_status_check;
alter table if exists documents add constraint documents_status_check
  check (status in ('pending_review','registered','reviewed','linked','ignored'));

create table if not exists property_financing_payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  payment_month date not null,
  payment_date date not null,
  lender text,
  total_payment numeric not null default 0,
  interest_amount numeric not null default 0,
  principal_amount numeric not null default 0,
  outstanding_principal numeric,
  notes text,
  linked_document_id uuid references documents(id),
  drive_file_id uuid references drive_files(id),
  source text default 'manual',
  data_origin text default 'manual',
  is_demo boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_financing_property_month on property_financing_payments(property_id, payment_month);
create unique index if not exists idx_financing_property_month_unique
  on property_financing_payments(property_id, payment_month)
  where coalesce(is_demo,false) = false;
