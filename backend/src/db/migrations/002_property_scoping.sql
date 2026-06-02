alter table if exists expenses add column if not exists property_id uuid;
alter table if exists income add column if not exists property_id uuid;
alter table if exists documents add column if not exists property_id uuid;

update expenses
set property_id = (select id from properties order by created_at asc limit 1)
where property_id is null and exists (select 1 from properties);

update income
set property_id = (select id from properties order by created_at asc limit 1)
where property_id is null and exists (select 1 from properties);

update documents
set property_id = (select id from properties order by created_at asc limit 1)
where property_id is null and exists (select 1 from properties);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'expenses' and column_name = 'property_id' and is_nullable = 'YES')
     and not exists (select 1 from expenses where property_id is null) then
    alter table expenses alter column property_id set not null;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'income' and column_name = 'property_id' and is_nullable = 'YES')
     and not exists (select 1 from income where property_id is null) then
    alter table income alter column property_id set not null;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'documents' and column_name = 'property_id' and is_nullable = 'YES')
     and not exists (select 1 from documents where property_id is null) then
    alter table documents alter column property_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_property_id_fkey') then
    alter table expenses add constraint expenses_property_id_fkey foreign key (property_id) references properties(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'income_property_id_fkey') then
    alter table income add constraint income_property_id_fkey foreign key (property_id) references properties(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'documents_property_id_fkey') then
    alter table documents add constraint documents_property_id_fkey foreign key (property_id) references properties(id);
  end if;
end $$;

create index if not exists idx_expenses_property_id on expenses(property_id);
create index if not exists idx_income_property_id on income(property_id);
create index if not exists idx_documents_property_id on documents(property_id);
