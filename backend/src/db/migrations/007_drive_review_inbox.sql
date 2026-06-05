alter table if exists drive_files drop constraint if exists drive_files_review_status_check;

alter table if exists drive_files
  add constraint drive_files_review_status_check
  check (review_status in ('pending_review','registered','reviewed','linked','ignored'));

alter table if exists expenses add column if not exists drive_file_id uuid references drive_files(id);
alter table if exists documents add column if not exists drive_file_id uuid references drive_files(id);

create index if not exists idx_expenses_drive_file_id on expenses(drive_file_id);
create index if not exists idx_documents_drive_file_id on documents(drive_file_id);

delete from property_drive_folders
where drive_folder_id = 'google_oauth_account'
   or drive_folder_name = 'Cuenta Google Drive';
