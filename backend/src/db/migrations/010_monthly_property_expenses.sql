alter table if exists expenses add column if not exists expense_month date;
alter table if exists expenses add column if not exists monthly_category text;
alter table if exists expenses add column if not exists data_origin text default 'manual';
alter table if exists expenses add column if not exists source_method text default 'manual';
alter table if exists expenses add column if not exists is_demo boolean default false;

create unique index if not exists idx_expenses_monthly_unique
on expenses(property_id, expense_month, monthly_category)
where monthly_category is not null;

create index if not exists idx_expenses_expense_month on expenses(expense_month);
create index if not exists idx_expenses_data_origin on expenses(data_origin);
