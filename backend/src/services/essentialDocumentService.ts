import { query } from "../config/db.js";
import { validateProperty } from "./crudService.js";

const essentialTypes = new Set(["ibi","home_insurance","garbage_tax","energy_certificate","occupancy_certificate","tourist_license","other_essential"]);

export async function groupedEssentialDocuments(schemaName: string, propertyId: string, yearInput: unknown) {
  await validateProperty(schemaName, propertyId);
  const year = normalizeYear(yearInput);
  const result = await query(
    `select *
     from documents
     where property_id = $1
       and coalesce(document_category, 'essential') = 'essential'
       and deleted_at is null
       and coalesce(document_date, created_at::date) >= $2::date
       and coalesce(document_date, created_at::date) < ($2::date + interval '1 year')
       and coalesce(is_demo,false) = false
     order by coalesce(document_date, created_at::date) asc, created_at asc`,
    [propertyId, `${year}-01-01`],
    schemaName
  );
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const items = result.rows.filter((row: any) => toMonth(row.document_date ?? row.created_at) === month);
    const documentTotal = items.reduce((total: number, row: any) => total + Number(row.amount ?? row.cost ?? 0), 0);
    return { month, label: monthLabel(month), document_total: documentTotal, ordinary_cost_total: documentTotal, items };
  });
  return { year, months, year_total: months.reduce((total, month) => total + month.document_total, 0) };
}

export async function createEssentialDocument(schemaName: string, propertyId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const data = normalizeDocument(input);
  const result = await query(
    `insert into documents
      (property_id, title, type, subtype, document_type, document_category, document_date, valid_until, expiration_date,
       amount, currency, provider, notes, status, source, source_provider, source_method, data_origin, is_demo)
     values ($1,$2,$3,$3,$3,'essential',$4::date,$5::date,$5::date,$6,'EUR',$7,$8,$9,$10,$11,$12,$13,false)
     returning *`,
    [propertyId, data.title, data.document_type, data.document_date, data.valid_until, data.amount, data.provider, data.notes, data.status, data.source, data.source_provider, data.source_method, data.data_origin],
    schemaName
  );
  return result.rows[0];
}

export async function updateEssentialDocument(schemaName: string, propertyId: string, documentId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const data = normalizeDocument(input);
  const result = await query(
    `update documents
     set title = $1,
         type = $2,
         subtype = $2,
         document_type = $2,
         document_category = 'essential',
         document_date = $3::date,
         valid_until = $4::date,
         expiration_date = $4::date,
         amount = $5,
         currency = 'EUR',
         provider = $6,
         notes = $7,
         status = $8,
         updated_at = now()
     where property_id = $9 and id = $10
     returning *`,
    [data.title, data.document_type, data.document_date, data.valid_until, data.amount, data.provider, data.notes, data.status, propertyId, documentId],
    schemaName
  );
  return result.rows[0] ?? null;
}

export async function deleteEssentialDocument(schemaName: string, propertyId: string, documentId: string) {
  await validateProperty(schemaName, propertyId);
  await query("update documents set status = 'ignored', deleted_at = now(), updated_at = now() where property_id = $1 and id = $2", [propertyId, documentId], schemaName);
  return { deleted: true };
}

function normalizeDocument(input: Record<string, unknown>) {
  const rawType = String(input.document_type ?? input.type ?? "other_essential");
  const documentType = essentialTypes.has(rawType) ? rawType : mapLegacyType(rawType);
  const documentDate = normalizeDate(input.document_date ?? input.issue_date, new Date().toISOString().slice(0, 10));
  return {
    title: String(input.title ?? "").trim() || "Documento esencial",
    document_type: documentType,
    document_date: documentDate,
    valid_until: normalizeDate(input.valid_until ?? input.expiration_date, documentDate),
    amount: normalizeNullableAmount(input.amount ?? input.cost),
    provider: textOrNull(input.provider),
    notes: textOrNull(input.notes),
    status: normalizeStatus(input.status),
    source: textOrNull(input.source) ?? "manual",
    source_provider: textOrNull(input.source_provider),
    source_method: textOrNull(input.source_method) ?? "manual",
    data_origin: textOrNull(input.data_origin) ?? "manual"
  };
}

function mapLegacyType(value: string) {
  const map: Record<string, string> = {
    seguro: "home_insurance",
    insurance: "home_insurance",
    basuras: "garbage_tax",
    certificado: "energy_certificate",
    certificate: "energy_certificate",
    cedula: "occupancy_certificate",
    licencia: "tourist_license"
  };
  return map[value] ?? "other_essential";
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "pending_review");
  return ["pending_review","registered","reviewed","linked","ignored"].includes(raw) ? raw : "pending_review";
}

function normalizeNullableAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function normalizeDate(value: unknown, fallback: string) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return fallback;
}

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizeYear(value: unknown) {
  const parsed = Number(value);
  const now = new Date().getFullYear();
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : now;
}

function toMonth(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(`${month}-01T12:00:00`));
}
