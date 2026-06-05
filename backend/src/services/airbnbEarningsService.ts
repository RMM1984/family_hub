import { query } from "../config/db.js";
import { validateProperty } from "./crudService.js";
import { createIncomeFromReservation } from "./airbnbService.js";

type ParsedCsvRow = {
  rowIndex: number;
  raw: Record<string, string>;
  normalized: {
    guest_name: string | null;
    check_in: string | null;
    check_out: string | null;
    amount: number | null;
    host_fee: number | null;
    cleaning_fee: number | null;
    taxes: number | null;
    payout: number | null;
    listing: string | null;
    confirmation_code: string | null;
    currency: string;
  };
};

type MatchResult = {
  reservationId: string | null;
  incomeId: string | null;
  status: "matched" | "possible_match" | "unmatched";
  confidence: number;
};

const fieldAliases: Record<string, keyof ParsedCsvRow["normalized"]> = {
  guest: "guest_name",
  guestname: "guest_name",
  huesped: "guest_name",
  huespedes: "guest_name",
  nombrehuesped: "guest_name",
  nombredehuesped: "guest_name",
  nombredelhuesped: "guest_name",
  nombredelapersona: "guest_name",
  checkin: "check_in",
  entrada: "check_in",
  fechadeentrada: "check_in",
  fechainicio: "check_in",
  fechadeinicio: "check_in",
  arrival: "check_in",
  startdate: "check_in",
  checkout: "check_out",
  salida: "check_out",
  fechadesalida: "check_out",
  fechafinalizacion: "check_out",
  fechadefinalizacion: "check_out",
  fechafin: "check_out",
  departure: "check_out",
  enddate: "check_out",
  amount: "amount",
  importe: "amount",
  total: "amount",
  earnings: "amount",
  ingresos: "amount",
  ingresosnetos: "amount",
  importepago: "amount",
  importedepago: "amount",
  grossamount: "amount",
  hostfee: "host_fee",
  hostservicefee: "host_fee",
  comisionanfitrion: "host_fee",
  tarifadeservicioanfitrion: "host_fee",
  tarifadeserviciodelanfitrion: "host_fee",
  cleaningfee: "cleaning_fee",
  limpiezafee: "cleaning_fee",
  gastosdelimpieza: "cleaning_fee",
  tarifadelimpieza: "cleaning_fee",
  taxes: "taxes",
  tax: "taxes",
  impuestos: "taxes",
  payout: "payout",
  cobro: "payout",
  pago: "payout",
  importeabonado: "payout",
  importeapagar: "payout",
  importedelpago: "payout",
  listing: "listing",
  anuncio: "listing",
  alojamiento: "listing",
  vivienda: "listing",
  confirmationcode: "confirmation_code",
  codigo: "confirmation_code",
  codigoconfirmacion: "confirmation_code",
  codigodeconfirmacion: "confirmation_code",
  codigodereserva: "confirmation_code",
  reservationcode: "confirmation_code",
  reservationid: "confirmation_code"
};

export async function importCsv(schemaName: string, propertyId: string, userId: string | undefined, file: Express.Multer.File | undefined) {
  await validateProperty(schemaName, propertyId);
  if (!file) {
    const err = new Error("Debes subir un archivo CSV de Airbnb") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const rows = parseCsvFile(file.buffer.toString("utf8"));
  if (rows.length === 0) {
    const err = new Error("El CSV no contiene filas importables") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const created = await query(
    `insert into airbnb_earnings_imports (property_id, filename, uploaded_by, rows_total)
     values ($1,$2,$3,$4)
     returning *`,
    [propertyId, file.originalname ?? "airbnb.csv", userId ?? null, rows.length],
    schemaName
  );
  const importId = created.rows[0].id as string;
  let applicable = 0;

  for (const row of rows) {
    const match = await matchReservation(schemaName, propertyId, row);
    if (canApplyCsvRow(row)) applicable += 1;
    await query(
      `insert into airbnb_earnings_import_rows
       (import_id, property_id, row_index, raw_data, reservation_id, income_id, match_status, match_confidence,
        suggested_check_in, suggested_check_out, suggested_guest_name, suggested_amount, suggested_currency,
        suggested_host_fee, suggested_cleaning_fee, suggested_taxes, suggested_payout)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        importId,
        propertyId,
        row.rowIndex,
        JSON.stringify(row.raw),
        match.reservationId,
        match.incomeId,
        match.status,
        match.confidence,
        row.normalized.check_in,
        row.normalized.check_out,
        row.normalized.guest_name,
        row.normalized.amount,
        row.normalized.currency,
        row.normalized.host_fee,
        row.normalized.cleaning_fee,
        row.normalized.taxes,
        row.normalized.payout
      ],
      schemaName
    );
  }

  await query(
    "update airbnb_earnings_imports set rows_matched = $1, status = $2 where id = $3",
    [applicable, applicable > 0 ? "ready_to_apply" : "needs_review", importId],
    schemaName
  );
  return getImport(schemaName, propertyId, importId);
}

export async function getImport(schemaName: string, propertyId: string, importId: string) {
  await validateProperty(schemaName, propertyId);
  const importResult = await query(
    "select * from airbnb_earnings_imports where property_id = $1 and id = $2",
    [propertyId, importId],
    schemaName
  );
  const imported = importResult.rows[0];
  if (!imported) {
    const err = new Error("Importacion CSV no encontrada en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  const rows = await query(
    `select aer.*,
            pr.check_in as reservation_check_in,
            pr.check_out as reservation_check_out,
            pr.guest_name as reservation_guest_name,
            i.amount as income_amount,
            i.amount_status as income_amount_status
     from airbnb_earnings_import_rows aer
     left join property_reservations pr on pr.id = aer.reservation_id and pr.property_id = aer.property_id
     left join income i on i.id = coalesce(aer.income_id, pr.income_id) and i.property_id = aer.property_id
     where aer.property_id = $1 and aer.import_id = $2
     order by aer.row_index asc`,
    [propertyId, importId],
    schemaName
  );
  return { ...imported, rows: rows.rows };
}

export async function applyImport(schemaName: string, propertyId: string, importId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const rowIds = Array.isArray(input.row_ids) ? input.row_ids.map(String) : [];
  const confirmOverwrite = Boolean(input.confirm_overwrite);
  const applyAllSafe = Boolean(input.apply_all_safe);
  const params: unknown[] = [propertyId, importId];
  const rowClause = rowIds.length > 0 ? `and id = any($3::uuid[])` : applyAllSafe ? "and match_status in ('matched','possible_match','unmatched')" : "and match_status = 'matched'";
  if (rowIds.length > 0) params.push(rowIds);
  const rowsResult = await query(
    `select * from airbnb_earnings_import_rows
     where property_id = $1 and import_id = $2 and applied = false ${rowClause}
     order by row_index asc`,
    params,
    schemaName
  );

  let applied = 0;
  let skipped = 0;
  for (const row of rowsResult.rows as any[]) {
    if (row.suggested_amount === null || row.suggested_amount === undefined || !row.suggested_check_in || !row.suggested_check_out) {
      skipped += 1;
      continue;
    }
    const reservationId = row.reservation_id ?? await createReservationFromCsvRow(schemaName, propertyId, row);
    if (!reservationId) {
      skipped += 1;
      continue;
    }
    const income = await createIncomeFromReservation(schemaName, propertyId, reservationId, {});
    const current = await query("select * from income where property_id = $1 and id = $2", [propertyId, income.id], schemaName);
    const currentIncome = current.rows[0] as any;
    const guestName = cleanText(row.suggested_guest_name);
    const guestCount = guestCountFromRaw(row.raw_data);
    await query(
      `update property_reservations
       set guest_name = coalesce($1, guest_name),
           title = coalesce($2, title),
           guest_count = coalesce($3, guest_count),
           guest_count_status = case when $3::int is null then guest_count_status else 'imported' end
       where property_id = $4 and id = $5`,
      [guestName, guestName ? `Airbnb - ${guestName}` : null, guestCount, propertyId, reservationId],
      schemaName
    );
    const hasProtectedAmount = ["manual", "confirmed"].includes(String(currentIncome?.amount_status ?? "")) && currentIncome.amount !== null && currentIncome.amount !== undefined;
    if (hasProtectedAmount && !confirmOverwrite) {
      skipped += 1;
      continue;
    }
    const amount = Number(row.suggested_amount);
    await query(
      `update income
       set amount = $1,
           amount_status = 'confirmed',
           source = 'airbnb',
           source_method = 'csv',
           data_origin = 'airbnb_csv',
           imported_from_airbnb = true,
           reservation_id = $2,
           guest_name = coalesce($3, guest_name),
           description = coalesce($4, description),
           metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb
       where property_id = $6 and id = $7
       returning *`,
      [
        amount,
        reservationId,
        guestName,
        guestName ? `Airbnb - ${guestName}` : null,
        JSON.stringify({
          airbnb_csv_import_id: importId,
          airbnb_csv_row_id: row.id,
          host_fee: row.suggested_host_fee,
          cleaning_fee: row.suggested_cleaning_fee,
          taxes: row.suggested_taxes,
          payout: row.suggested_payout,
          currency: row.suggested_currency ?? "EUR",
          guests: guestCount
        }),
        propertyId,
        income.id
      ],
      schemaName
    );
    await query(
      "update property_reservations set income_id = $1, amount_status = 'confirmed', data_origin = 'airbnb_csv' where property_id = $2 and id = $3",
      [income.id, propertyId, reservationId],
      schemaName
    );
    await query(
      "update airbnb_earnings_import_rows set applied = true, applied_at = now(), match_status = 'applied', reservation_id = $1, income_id = $2 where property_id = $3 and id = $4",
      [reservationId, income.id, propertyId, row.id],
      schemaName
    );
    applied += 1;
  }

  await query(
    `update airbnb_earnings_imports
     set rows_applied = (select count(*)::int from airbnb_earnings_import_rows where import_id = $1 and applied = true),
         status = case
           when (select count(*) from airbnb_earnings_import_rows where import_id = $1 and applied = false and match_status in ('matched','possible_match','unmatched')) = 0 then 'applied'
           else 'partially_applied'
         end,
         metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
     where property_id = $3 and id = $1`,
    [importId, JSON.stringify({ last_apply: { applied, skipped } }), propertyId],
    schemaName
  );
  return getImport(schemaName, propertyId, importId);
}

async function createReservationFromCsvRow(schemaName: string, propertyId: string, row: any) {
  const guestName = cleanText(row.suggested_guest_name);
  const guestCount = guestCountFromRaw(row.raw_data);
  const confirmationCode = cleanText(row.raw_data?.codigodeconfirmacion ?? row.raw_data?.codigo ?? row.raw_data?.reservationcode);
  const externalId = confirmationCode ? `csv:${confirmationCode}` : `csv:${row.suggested_check_in}:${row.suggested_check_out}:${normalizeHeader(guestName ?? "sin-huesped")}`;
  const result = await query(
    `insert into property_reservations
      (property_id, source, external_id, title, guest_name, check_in, check_out, nights, status,
       imported_from_ical, raw_ical, source_method, data_origin, is_demo, guest_count, guest_count_status, amount_status, synced_at)
     values ($1,'airbnb',$2,$3,$4,$5::date,$6::date,$7,'confirmed',
       false,$8::jsonb,'csv','airbnb_csv',false,$9,$10,'confirmed',now())
     on conflict (property_id, source, external_id) do update set
       title = excluded.title,
       guest_name = excluded.guest_name,
       check_in = excluded.check_in,
       check_out = excluded.check_out,
       nights = excluded.nights,
       status = excluded.status,
       imported_from_ical = false,
       raw_ical = excluded.raw_ical,
       source_method = 'csv',
       data_origin = 'airbnb_csv',
       is_demo = false,
       guest_count = coalesce(excluded.guest_count, property_reservations.guest_count),
       guest_count_status = excluded.guest_count_status,
       amount_status = 'confirmed',
       synced_at = now()
     returning id`,
    [
      propertyId,
      externalId,
      guestName ? `Airbnb - ${guestName}` : "Airbnb",
      guestName,
      row.suggested_check_in,
      row.suggested_check_out,
      daysBetween(row.suggested_check_in, row.suggested_check_out),
      JSON.stringify(row.raw_data ?? {}),
      guestCount,
      guestCount === null ? "missing" : "imported"
    ],
    schemaName
  );
  return result.rows[0]?.id ?? null;
}

function parseCsvFile(content: string) {
  const text = content.replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const delimiter = detectDelimiter(text);
  const records = parseDelimited(text, delimiter);
  const headers = records.shift()?.map(normalizeHeader) ?? [];
  if (headers.length === 0) return [];
  return records
    .filter((record) => record.some((cell) => cell.trim()))
    .map((record, index) => {
      const raw: Record<string, string> = {};
      const values: Record<keyof ParsedCsvRow["normalized"], string | null> = {
        guest_name: null,
        check_in: null,
        check_out: null,
        amount: null,
        host_fee: null,
        cleaning_fee: null,
        taxes: null,
        payout: null,
        listing: null,
        confirmation_code: null,
        currency: null
      };
      headers.forEach((header, cellIndex) => {
        const value = (record[cellIndex] ?? "").trim();
        raw[header || `columna_${cellIndex + 1}`] = value;
        const field = fieldAliases[header];
        if (field && value) values[field] = value;
      });
      const amount = parseMoney(values.amount) ?? parseMoney(values.payout);
      const normalized: ParsedCsvRow["normalized"] = {
        guest_name: cleanText(values.guest_name),
        check_in: parseCsvDate(values.check_in),
        check_out: parseCsvDate(values.check_out),
        amount,
        host_fee: parseMoney(values.host_fee),
        cleaning_fee: parseMoney(values.cleaning_fee),
        taxes: parseMoney(values.taxes),
        payout: parseMoney(values.payout),
        listing: cleanText(values.listing),
        confirmation_code: cleanText(values.confirmation_code),
        currency: inferCurrency(record.join(" ")) ?? "EUR"
      };
      return { rowIndex: index + 2, raw, normalized };
    });
}

function canApplyCsvRow(row: ParsedCsvRow) {
  return Boolean(row.normalized.check_in && row.normalized.check_out && row.normalized.amount !== null && row.normalized.amount !== undefined);
}

async function matchReservation(schemaName: string, propertyId: string, row: ParsedCsvRow): Promise<MatchResult> {
  if (!row.normalized.check_in || !row.normalized.check_out) {
    return { reservationId: null, incomeId: null, status: "unmatched", confidence: 0 };
  }
  const result = await query(
    `select pr.*, i.id as income_id
     from property_reservations pr
     left join income i on i.property_id = pr.property_id and i.reservation_id = pr.id
     where pr.property_id = $1
       and pr.source = 'airbnb'
       and coalesce(pr.is_demo,false) = false
       and pr.check_in between ($2::date - interval '2 days') and ($2::date + interval '2 days')
     order by pr.check_in asc`,
    [propertyId, row.normalized.check_in],
    schemaName
  );
  let best: { reservation: any; confidence: number } | null = null;
  for (const reservation of result.rows as any[]) {
    const confidence = scoreReservation(row, reservation);
    if (!best || confidence > best.confidence) best = { reservation, confidence };
  }
  if (!best || best.confidence < 0.55) {
    return { reservationId: null, incomeId: null, status: "unmatched", confidence: best?.confidence ?? 0 };
  }
  return {
    reservationId: best.reservation.id,
    incomeId: best.reservation.income_id ?? null,
    status: best.confidence >= 0.9 ? "matched" : "possible_match",
    confidence: Number(best.confidence.toFixed(2))
  };
}

function scoreReservation(row: ParsedCsvRow, reservation: any) {
  let score = 0;
  const rowStart = row.normalized.check_in;
  const rowEnd = row.normalized.check_out;
  if (row.normalized.confirmation_code && String(reservation.external_id ?? "").includes(row.normalized.confirmation_code)) score += 0.5;
  if (rowStart === toDateString(reservation.check_in) && rowEnd === toDateString(reservation.check_out)) score += 0.75;
  else if (rowStart === toDateString(reservation.check_in)) score += 0.38;
  const nights = rowStart && rowEnd ? daysBetween(rowStart, rowEnd) : null;
  if (nights !== null && nights === Number(reservation.nights ?? 0)) score += 0.17;
  if (row.normalized.guest_name && reservation.guest_name && similarName(row.normalized.guest_name, String(reservation.guest_name))) score += 0.15;
  return Math.min(1, score);
}

function detectDelimiter(content: string) {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
}

function parseDelimited(content: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cleanText(value: string | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function guestCountFromRaw(raw: unknown) {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const count = parseInteger(data.ndeadultos) + parseInteger(data.ndeninos) + parseInteger(data.ndebebes);
  return count > 0 ? count : null;
}

function parseInteger(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function parseCsvDate(value: string | null) {
  const raw = cleanText(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const split = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (split) {
    const first = Number(split[1]);
    const second = Number(split[2]);
    const year = split[3].length === 2 ? `20${split[3]}` : split[3];
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return toDateString(date);
}

function parseMoney(value: string | null) {
  const raw = cleanText(value);
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function inferCurrency(text: string) {
  if (text.includes("€") || /\bEUR\b/i.test(text)) return "EUR";
  if (text.includes("$") || /\bUSD\b/i.test(text)) return "USD";
  if (text.includes("£") || /\bGBP\b/i.test(text)) return "GBP";
  return null;
}

function toDateString(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
}

function similarName(left: string, right: string) {
  const a = normalizeHeader(left);
  const b = normalizeHeader(right);
  return a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a));
}
