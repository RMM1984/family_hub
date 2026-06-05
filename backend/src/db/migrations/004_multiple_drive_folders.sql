create table if not exists property_drive_folders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  connection_id uuid null references property_drive_integrations(id),
  drive_folder_id text not null,
  drive_folder_name text not null,
  drive_folder_url text,
  folder_type text not null check (folder_type in ('facturas','documentos','contratos','seguros','ibi','comunidad','mantenimiento','reservas','otros')),
  provider_hint text,
  sync_enabled boolean default true,
  connected_at timestamptz default now(),
  last_sync_at timestamptz,
  metadata jsonb default '{}',
  unique(property_id, drive_folder_id)
);

alter table if exists drive_files add column if not exists drive_folder_mapping_id uuid references property_drive_folders(id);
alter table if exists drive_files add column if not exists folder_type text check (folder_type in ('facturas','documentos','contratos','seguros','ibi','comunidad','mantenimiento','reservas','otros') or folder_type is null);
alter table if exists drive_files add column if not exists provider_hint text;
alter table if exists drive_files add column if not exists review_status text default 'pending_review' check (review_status in ('pending_review','reviewed','linked','ignored'));
alter table if exists drive_files add column if not exists source_provider text default 'google_drive';
alter table if exists drive_files add column if not exists source_method text default 'drive_folder';
alter table if exists drive_files add column if not exists source_folder_name text;
alter table if exists drive_files add column if not exists source_synced_at timestamptz default now();
alter table if exists drive_files add column if not exists metadata jsonb default '{}';

insert into property_drive_folders (
  property_id,
  connection_id,
  drive_folder_id,
  drive_folder_name,
  drive_folder_url,
  folder_type,
  sync_enabled,
  connected_at,
  last_sync_at
)
select
  property_id,
  id,
  folder_id,
  coalesce(folder_name, 'Carpeta Drive'),
  folder_url,
  'documentos',
  true,
  connected_at,
  last_sync_at
from property_drive_integrations
where is_active = true
on conflict (property_id, drive_folder_id) do nothing;

update drive_files df
set
  drive_folder_mapping_id = pdf.id,
  folder_type = coalesce(df.folder_type, pdf.folder_type),
  provider_hint = coalesce(df.provider_hint, pdf.provider_hint),
  source_folder_name = coalesce(df.source_folder_name, pdf.drive_folder_name),
  source_synced_at = coalesce(df.source_synced_at, df.synced_at)
from property_drive_folders pdf
where df.property_id = pdf.property_id
  and df.drive_folder_id = pdf.drive_folder_id
  and df.drive_folder_mapping_id is null;

create index if not exists idx_property_drive_folders_property_id on property_drive_folders(property_id);
create index if not exists idx_property_drive_folders_folder_type on property_drive_folders(folder_type);
create index if not exists idx_drive_files_folder_mapping_id on drive_files(drive_folder_mapping_id);
create index if not exists idx_drive_files_review_status on drive_files(review_status);
create index if not exists idx_drive_files_folder_type on drive_files(folder_type);
create index if not exists idx_drive_files_provider_hint on drive_files(provider_hint);
