import { query } from "../config/db.js";
import { parseAirbnbIcal } from "../utils/ical-parser.js";
import { validateProperty } from "./crudService.js";

const operationTypes = new Set(["tourist", "long_term", "own_use", "mixed", "inactive"]);
const reservationStatuses = new Set(["confirmed", "cancelled", "blocked"]);
const amountStatuses = new Set(["missing", "manual", "estimated", "confirmed"]);

export async function listReservations(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const result = await query(
    `select pr.*,
            i.id as income_id,
            i.amount as income_amount,
            i.amount_status as income_amount_status
     from property_reservations pr
     left join income i on i.reservation_id = pr.id and i.property_id = pr.property_id
     where pr.property_id = $1
     order by pr.check_in asc`,
    [propertyId],
    schemaName
  );
  return result.rows;
}

export async function getCalendar(schemaName: string, propertyId: string) {
  const reservations = await listReservations(schemaName, propertyId);
  return {
    reservations,
    events: reservations.map((reservation: any) => ({
      id: reservation.id,
      title: reservation.guest_name ?? reservation.title ?? "Reserva",
      start: reservation.check_in,
      end: reservation.check_out,
      status: reservation.status,
      income_status: reservation.income_amount_status ?? "missing"
    }))
  };
}

export async function saveIcalUrl(schemaName: string, propertyId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const url = String(input.airbnb_ical_url ?? input.ical_url ?? "").trim();
  if (!url.startsWith("http")) {
    const err = new Error("La URL iCal de Airbnb no es valida") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query(
    `update properties
     set airbnb_ical_url = $1,
         airbnb_enabled = true,
         operation_type = case when operation_type in ('long_term','own_use','inactive') then 'tourist' else coalesce(operation_type, 'tourist') end,
         rental_type = case when rental_type in ('long_term','own_use','inactive') then 'tourist' else coalesce(rental_type, 'tourist') end
     where id = $2
     returning *`,
    [url, propertyId],
    schemaName
  );
  return result.rows[0];
}

export async function syncAirbnb(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const property = await query("select id, airbnb_ical_url from properties where id = $1", [propertyId], schemaName);
  const row = property.rows[0] as any;
  if (!row?.airbnb_ical_url) {
    const err = new Error("La vivienda no tiene URL iCal de Airbnb") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const events = await parseAirbnbIcal(row.airbnb_ical_url);
  let imported = 0;
  let updated = 0;
  for (const event of events) {
    const result = await query(
      `insert into property_reservations
        (property_id, source, external_id, title, guest_name, check_in, check_out, nights, status, imported_from_ical, raw_ical, synced_at)
       values ($1,'airbnb',$2,$3,$4,$5,$6,$7,'confirmed',true,$8,now())
       on conflict (property_id, source, external_id) do update set
        title = excluded.title,
        guest_name = excluded.guest_name,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        nights = excluded.nights,
        raw_ical = excluded.raw_ical,
        synced_at = now()
       returning (xmax = 0) as inserted`,
      [propertyId, event.uid, event.title ?? event.guest_name, event.guest_name, event.check_in, event.check_out, event.nights, JSON.stringify(event)],
      schemaName
    );
    if (result.rows[0]?.inserted) imported += 1;
    else updated += 1;
  }
  await query("update properties set airbnb_last_sync_at = now(), airbnb_enabled = true where id = $1", [propertyId], schemaName);
  await query("insert into ical_sync_log (property_id, reservations_imported) values ($1,$2)", [propertyId, imported], schemaName);
  return { imported, updated, reservations: await listReservations(schemaName, propertyId) };
}

export async function updateReservation(schemaName: string, propertyId: string, reservationId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const status = input.status === undefined ? null : String(input.status);
  if (status && !reservationStatuses.has(status)) {
    const err = new Error("Estado de reserva no permitido") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query(
    `update property_reservations
     set guest_name = coalesce($1, guest_name),
         title = coalesce($2, title),
         status = coalesce($3, status)
     where property_id = $4 and id = $5
     returning *`,
    [input.guest_name ?? null, input.title ?? null, status, propertyId, reservationId],
    schemaName
  );
  if (!result.rows[0]) {
    const err = new Error("Reserva no encontrada en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

export async function createIncomeFromReservation(schemaName: string, propertyId: string, reservationId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const reservationResult = await query("select * from property_reservations where property_id = $1 and id = $2", [propertyId, reservationId], schemaName);
  const reservation = reservationResult.rows[0] as any;
  if (!reservation) {
    const err = new Error("Reserva no encontrada en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  const existing = await query("select * from income where property_id = $1 and reservation_id = $2", [propertyId, reservationId], schemaName);
  const amount = input.amount === undefined || input.amount === null || input.amount === "" ? null : Number(input.amount);
  const amountStatus = normalizeAmountStatus(input.amount_status, amount);
  if (existing.rows[0]) {
    const result = await query(
      `update income
       set amount = coalesce($1, amount),
           amount_status = $2,
           guest_name = coalesce($3, guest_name),
           check_in = $4,
           check_out = $5,
           nights = $6
       where property_id = $7 and reservation_id = $8
       returning *`,
      [amount, amountStatus, reservation.guest_name, reservation.check_in, reservation.check_out, reservation.nights, propertyId, reservationId],
      schemaName
    );
    return result.rows[0];
  }
  const result = await query(
    `insert into income
      (property_id, reservation_id, source, amount, income_date, description, guest_name, check_in, check_out, nights, airbnb_reservation_id, imported_from_ical, imported_from_airbnb, amount_status)
     values ($1,$2,'airbnb',$3,$4,$5,$6,$7,$8,$9,$10,true,true,$11)
     returning *`,
    [
      propertyId,
      reservationId,
      amount,
      reservation.check_in,
      reservation.title ?? "Reserva Airbnb",
      reservation.guest_name,
      reservation.check_in,
      reservation.check_out,
      reservation.nights,
      reservation.external_id,
      amountStatus
    ],
    schemaName
  );
  return result.rows[0];
}

export async function updatePropertyOperation(schemaName: string, propertyId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const operationType = String(input.operation_type ?? input.rental_type ?? "");
  if (operationType && !operationTypes.has(operationType)) {
    const err = new Error("Tipo de operacion no permitido") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query(
    `update properties
     set operation_type = coalesce($1, operation_type),
         rental_type = coalesce($1, rental_type),
         airbnb_enabled = coalesce($2, airbnb_enabled)
     where id = $3
     returning *`,
    [operationType || null, input.airbnb_enabled === undefined ? null : Boolean(input.airbnb_enabled), propertyId],
    schemaName
  );
  return result.rows[0];
}

function normalizeAmountStatus(value: unknown, amount: number | null) {
  const raw = String(value ?? "").trim();
  if (raw && amountStatuses.has(raw)) return raw;
  return amount === null ? "missing" : "manual";
}
