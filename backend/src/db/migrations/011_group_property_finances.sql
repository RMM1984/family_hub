alter table if exists income add column if not exists currency text default 'EUR';
alter table if exists income add column if not exists updated_at timestamptz default now();
create index if not exists idx_income_property_date on income(property_id, income_date);

alter table if exists expenses drop constraint if exists expenses_category_check;
alter table if exists expenses add constraint expenses_category_check check (category in (
  'electricity','water','gas','internet','community','cleaning','supplies','supermarket','ibi','garbage',
  'home_insurance','liability_insurance','rental_insurance','insurance','taxes','maintenance','repairs',
  'renovation','furniture','airbnb_commission','mortgage','financing','loan_interest','other'
));
alter table if exists expenses add column if not exists currency text default 'EUR';
alter table if exists expenses add column if not exists source text default 'manual';
alter table if exists expenses add column if not exists linked_document_id uuid references documents(id);
alter table if exists expenses add column if not exists updated_at timestamptz default now();
create index if not exists idx_expenses_property_date on expenses(property_id, expense_date);

alter table if exists documents drop constraint if exists documents_type_check;
alter table if exists documents add constraint documents_type_check check (type in (
  'factura','contrato','seguro','ibi','comunidad','certificado','garantia','manual','reserva','otro',
  'insurance','license','certificate','inspection','contract','warranty','deed','other'
));
alter table if exists documents add column if not exists document_date date;
alter table if exists documents add column if not exists amount numeric;
alter table if exists documents add column if not exists currency text default 'EUR';
alter table if exists documents add column if not exists status text default 'pending_review';
alter table if exists documents add column if not exists source text default 'manual';
alter table if exists documents add column if not exists source_provider text;
alter table if exists documents add column if not exists source_method text;
alter table if exists documents add column if not exists linked_expense_id uuid references expenses(id);
alter table if exists documents add column if not exists linked_income_id uuid references income(id);
alter table if exists documents add column if not exists data_origin text default 'manual';
alter table if exists documents add column if not exists is_demo boolean default false;
alter table if exists documents add column if not exists updated_at timestamptz default now();
alter table if exists documents drop constraint if exists documents_status_check;
alter table if exists documents add constraint documents_status_check check (status in ('pending_review','reviewed','linked','ignored'));
create index if not exists idx_documents_property_document_date on documents(property_id, document_date);
create index if not exists idx_documents_property_expiration_date on documents(property_id, expiration_date);
