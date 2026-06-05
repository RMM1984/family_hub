do $$
begin
  if exists (select 1 from pg_constraint where conname = 'income_airbnb_reservation_id_key') then
    alter table income drop constraint income_airbnb_reservation_id_key;
  end if;
end $$;

create unique index if not exists idx_income_property_airbnb_reservation
  on income(property_id, airbnb_reservation_id)
  where airbnb_reservation_id is not null;

create unique index if not exists idx_income_property_reservation
  on income(property_id, reservation_id)
  where reservation_id is not null;
