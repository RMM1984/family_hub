create table if not exists property_drive_integrations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  provider text default 'google_drive',
  folder_id text not null,
  folder_name text,
  folder_url text,
  connected_by uuid,
  connected_at timestamptz default now(),
  last_sync_at timestamptz,
  is_active boolean default true,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  unique(property_id, provider)
);

create table if not exists drive_files (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  drive_folder_id text not null,
  drive_file_id text not null,
  name text not null,
  mime_type text,
  size bigint,
  web_view_link text,
  web_content_link text,
  created_time timestamptz,
  modified_time timestamptz,
  document_type text check (document_type in ('factura','contrato','seguro','ibi','comunidad','mantenimiento','reserva','otro') or document_type is null),
  linked_expense_id uuid references expenses(id),
  linked_income_id uuid references income(id),
  linked_document_id uuid references documents(id),
  expiration_date date,
  synced_at timestamptz default now(),
  unique(property_id, drive_file_id)
);

create index if not exists idx_property_drive_integrations_property_id on property_drive_integrations(property_id);
create index if not exists idx_drive_files_property_id on drive_files(property_id);
create index if not exists idx_drive_files_drive_folder_id on drive_files(drive_folder_id);
create index if not exists idx_drive_files_document_type on drive_files(document_type);
create index if not exists idx_drive_files_expiration_date on drive_files(expiration_date);
