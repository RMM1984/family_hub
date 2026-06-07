alter table if exists documents add column if not exists deleted_at timestamptz;

alter table if exists drive_files drop constraint if exists drive_files_review_status_check;
alter table if exists drive_files
  add constraint drive_files_review_status_check
  check (review_status in (
    'pending_review',
    'registered',
    'reviewed',
    'linked',
    'registered_document',
    'registered_expense',
    'registered_income',
    'ignored'
  ));

create index if not exists idx_documents_property_deleted_at on documents(property_id, deleted_at);
