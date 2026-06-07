import { query } from "../config/db.js";
import { parseAirbnbIcal } from "../utils/ical-parser.js";
import { validateProperty } from "./crudService.js";

const operationTypes = new Set(["tourist", "long_term", "own_use", "mixed", "inactive"]);
const reservationStatuses = new Set(["confirmed", "cancelled", "blocked", "removed_from_calendar"]);
const amountStatuses = new Set(["missing", "manual", "estimated", "confirmed"]);

export async function listReservations(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const result = await query(
    `select pr.*,
            i.id as income_id,
            i.amount as income_amount,
            i.amount_status as income_amount_status,
            i.data_origin as income_data_origin,
            i.is_demo as income_is_demo,
            i.guest_name as income_guest_name,
            i.description as income_description
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
  const url = validateIcalUrl(input.airbnb_ical_url ?? input.ical_url);
  await ensureIcalCanBeParsed(url);
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
  const events = await ensureIcalCanBeParsed(row.airbnb_ical_url);
  const externalIds = events.map((event) => event.uid);
  let imported = 0;
  let updated = 0;
  let incomesCreated = 0;
  for (const event of events) {
    const result = await query(
      `insert into property_reservations
        (property_id, source, source_method, data_origin, is_demo, external_id, title, guest_name, guest_count, guest_count_status, check_in, check_out, nights, status, imported_from_ical, raw_summary, raw_description, raw_ical, synced_at, imported_at, last_seen_at, amount_status)
       values ($1,'airbnb','ical','airbnb_ical',false,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',true,$10,$11,$12,now(),now(),now(),'missing')
       on conflict (property_id, source, external_id) do update set
        title = excluded.title,
        guest_name = coalesce(property_reservations.guest_name, excluded.guest_name),
        guest_count = coalesce(property_reservations.guest_count, excluded.guest_count),
        guest_count_status = case when property_reservations.guest_count_status = 'manual' then property_reservations.guest_count_status else excluded.guest_count_status end,
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        nights = excluded.nights,
        status = 'confirmed',
        source_method = 'ical',
        data_origin = 'airbnb_ical',
        is_demo = false,
        raw_summary = excluded.raw_summary,
        raw_description = excluded.raw_description,
        raw_ical = excluded.raw_ical,
        synced_at = now(),
        last_seen_at = now()
       returning id, (xmax = 0) as inserted`,
      [
        propertyId,
        event.uid,
        event.title ?? "Reserva Airbnb",
        event.guest_name ?? null,
        event.guest_count ?? null,
        event.guest_count_status ?? "missing",
        event.check_in,
        event.check_out,
        event.nights,
        event.raw_summary ?? event.title ?? null,
        event.raw_description ?? event.description ?? null,
        JSON.stringify(event)
      ],
      schemaName
    );
    if (result.rows[0]?.inserted) imported += 1;
    else updated += 1;
    if (await ensureIncomeForReservation(schemaName, propertyId, result.rows[0].id)) {
      incomesCreated += 1;
    }
  }
  let removed = 0;
  if (externalIds.length > 0) {
    const result = await query(
      `update property_reservations
       set status = 'removed_from_calendar', synced_at = now()
       where property_id = $1
         and source = 'airbnb'
         and status <> 'removed_from_calendar'
         and external_id <> all($2::text[])
       returning id`,
      [propertyId, externalIds],
      schemaName
    );
    removed = result.rowCount ?? 0;
  }
  await query("update properties set airbnb_last_sync_at = now(), airbnb_enabled = true where id = $1", [propertyId], schemaName);
  await query("insert into ical_sync_log (property_id, reservations_imported) values ($1,$2)", [propertyId, imported], schemaName);
  return { imported, updated, removed, incomes_created: incomesCreated, reservations: await listReservations(schemaName, propertyId), stats: await getStats(schemaName, propertyId) };
}

export async function getStats(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const reservations = await listReservations(schemaName, propertyId) as any[];
  const active = reservations.filter((reservation) => !["cancelled", "removed_from_calendar"].includes(String(reservation.status)));
  const today = startOfDay(new Date());
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const next30End = addDays(today, 30);
  const upcoming = active.filter((reservation) => parseDate(reservation.check_in) >= today).sort((a, b) => parseDate(a.check_in).getTime() - parseDate(b.check_in).getTime());
  const upcomingCheckout = active.filter((reservation) => parseDate(reservation.check_out) >= today).sort((a, b) => parseDate(a.check_out).getTime() - parseDate(b.check_out).getTime());
  const bookedCurrentMonth = bookedNights(active, currentMonthStart, currentMonthEnd);
  const bookedNext30 = bookedNights(active, today, next30End);
  const checkInsCurrentMonth = active.filter((reservation) => {
    const date = parseDate(reservation.check_in);
    return date >= currentMonthStart && date < currentMonthEnd;
  }).length;
  const checkOutsCurrentMonth = active.filter((reservation) => {
    const date = parseDate(reservation.check_out);
    return date >= currentMonthStart && date < currentMonthEnd;
  }).length;
  const availableCurrentMonth = daysBetween(currentMonthStart, currentMonthEnd);
  const availableNext30 = daysBetween(today, next30End);
  return {
    reservations_total: reservations.length,
    upcoming_reservations: upcoming.length,
    next_check_in: upcoming[0]?.check_in ?? null,
    next_check_out: upcomingCheckout[0]?.check_out ?? null,
    booked_nights_current_month: bookedCurrentMonth,
    booked_nights_next_30_days: bookedNext30,
    occupancy_current_month: percentage(bookedCurrentMonth, availableCurrentMonth),
    occupancy_next_30_days: percentage(bookedNext30, availableNext30),
    check_ins_current_month: checkInsCurrentMonth,
    check_outs_current_month: checkOutsCurrentMonth,
    incomes_missing_amount: reservations.filter((reservation) => reservation.income_amount_status === "missing" || reservation.income_amount === null || reservation.income_amount === undefined).length,
    guests_known: reservations.reduce((sum, reservation) => sum + Number(reservation.guest_count ?? 0), 0)
  };
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
    const current = existing.rows[0] as any;
    const nextAmountStatus = amount === null ? current.amount_status ?? "missing" : amountStatus;
    const result = await query(
      `update income
       set amount = coalesce($1, amount),
           amount_status = $2,
           guest_name = coalesce($3, guest_name),
           check_in = $4,
           check_out = $5,
           nights = $6,
           source_method = coalesce(source_method, 'ical'),
           data_origin = case when coalesce(is_demo,false) then data_origin else 'airbnb_ical' end
       where property_id = $7 and reservation_id = $8
       returning *`,
      [amount, nextAmountStatus, reservation.guest_name, reservation.check_in, reservation.check_out, reservation.nights, propertyId, reservationId],
      schemaName
    );
    await syncReservationIncomeStatus(schemaName, propertyId, reservationId, result.rows[0]);
    return result.rows[0];
  }
  const result = await query(
    `insert into income
      (property_id, reservation_id, source, source_method, data_origin, is_demo, amount, income_date, description, guest_name, check_in, check_out, nights, airbnb_reservation_id, imported_from_ical, imported_from_airbnb, amount_status)
     values ($1,$2,'airbnb','ical','airbnb_ical',false,$3,$4,$5,$6,$7,$8,$9,$10,true,true,$11)
     returning *`,
    [
      propertyId,
      reservationId,
      amount,
      reservation.check_in,
      `Reserva Airbnb: ${reservation.check_in} - ${reservation.check_out}`,
      reservation.guest_name,
      reservation.check_in,
      reservation.check_out,
      reservation.nights,
      reservation.external_id,
      amountStatus
    ],
    schemaName
  );
  await syncReservationIncomeStatus(schemaName, propertyId, reservationId, result.rows[0]);
  return result.rows[0];
}

export async function updateReservationAmount(schemaName: string, propertyId: string, reservationId: string, input: Record<string, unknown>) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    const err = new Error("El importe debe ser un numero valido") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const income = await createIncomeFromReservation(schemaName, propertyId, reservationId, { amount, amount_status: "manual" });
  const reservation = await query("select * from property_reservations where property_id = $1 and id = $2", [propertyId, reservationId], schemaName);
  return { reservation: reservation.rows[0], income };
}

export async function updateGuestCount(schemaName: string, propertyId: string, reservationId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const guestCount = input.guest_count === null || input.guest_count === "" ? null : Number(input.guest_count);
  if (guestCount !== null && (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 50)) {
    const err = new Error("El numero de huespedes debe ser valido") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query(
    `update property_reservations
     set guest_count = $1,
         guest_count_status = case when $1::int is null then 'missing' else 'manual' end
     where property_id = $2 and id = $3
     returning *`,
    [guestCount, propertyId, reservationId],
    schemaName
  );
  if (!result.rows[0]) {
    const err = new Error("Reserva no encontrada en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

export async function disconnectAirbnb(schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  const result = await query(
    "update properties set airbnb_ical_url = null, airbnb_enabled = false where id = $1 returning *",
    [propertyId],
    schemaName
  );
  return result.rows[0];
}

async function ensureIncomeForReservation(schemaName: string, propertyId: string, reservationId: string) {
  const existing = await query("select id from income where property_id = $1 and reservation_id = $2", [propertyId, reservationId], schemaName);
  await createIncomeFromReservation(schemaName, propertyId, reservationId, {});
  return !existing.rows[0];
}

async function syncReservationIncomeStatus(schemaName: string, propertyId: string, reservationId: string, income: any) {
  await query(
    "update property_reservations set income_id = $1, amount_status = $2 where property_id = $3 and id = $4",
    [income.id, income.amount_status ?? "missing", propertyId, reservationId],
    schemaName
  );
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

function validateIcalUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid protocol");
    return url.toString();
  } catch {
    const err = new Error("La URL iCal de Airbnb no es una URL valida") as Error & { status: number };
    err.status = 400;
    throw err;
  }
}

async function ensureIcalCanBeParsed(url: string) {
  try {
    return await parseAirbnbIcal(url);
  } catch (error) {
    const err = new Error(`No se pudo leer el calendario iCal de Airbnb: ${String((error as Error).message ?? error)}`) as Error & { status: number };
    err.status = 400;
    throw err;
  }
}

function parseDate(value: string | Date) {
  return startOfDay(new Date(value));
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function bookedNights(reservations: any[], periodStart: Date, periodEnd: Date) {
  return reservations.reduce((sum, reservation) => {
    const start = parseDate(reservation.check_in);
    const end = parseDate(reservation.check_out);
    const overlapStart = start > periodStart ? start : periodStart;
    const overlapEnd = end < periodEnd ? end : periodEnd;
    return sum + daysBetween(overlapStart, overlapEnd);
  }, 0);
}

function percentage(value: number, total: number) {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
}
