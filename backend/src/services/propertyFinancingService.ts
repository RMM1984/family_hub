import { query } from "../config/db.js";
import { validateProperty } from "./crudService.js";

export async function groupedFinancing(schemaName: string, propertyId: string, yearInput: unknown) {
  await validateProperty(schemaName, propertyId);
  const year = normalizeYear(yearInput);
  const result = await query(
    `select fp.*, d.title as linked_document_title
     from property_financing_payments fp
     left join documents d on d.id = fp.linked_document_id and d.property_id = fp.property_id
     where fp.property_id = $1
       and fp.payment_month >= $2::date
       and fp.payment_month < ($2::date + interval '1 year')
       and coalesce(fp.is_demo,false) = false
     order by fp.payment_month asc, fp.payment_date asc`,
    [propertyId, `${year}-01-01`],
    schemaName
  );
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const items = result.rows.filter((row: any) => toMonth(row.payment_month) === month);
    const totalPayment = sum(items, "total_payment");
    const interestTotal = sum(items, "interest_amount");
    const principalTotal = sum(items, "principal_amount");
    const lastOutstanding = [...items].reverse().find((row: any) => row.outstanding_principal !== null && row.outstanding_principal !== undefined)?.outstanding_principal ?? null;
    return {
      month,
      label: monthLabel(month),
      total_payment: totalPayment,
      interest_total: interestTotal,
      principal_total: principalTotal,
      outstanding_principal: lastOutstanding === null ? null : Number(lastOutstanding),
      items
    };
  });
  return {
    year,
    months,
    year_total_payment: months.reduce((total, month) => total + month.total_payment, 0),
    year_interest_total: months.reduce((total, month) => total + month.interest_total, 0),
    year_principal_total: months.reduce((total, month) => total + month.principal_total, 0),
    latest_outstanding_principal: [...months].reverse().find((month) => month.outstanding_principal !== null)?.outstanding_principal ?? null
  };
}

export async function createFinancing(schemaName: string, propertyId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const data = normalizeInput(input);
  const result = await query(
    `insert into property_financing_payments
      (property_id, payment_month, payment_date, lender, total_payment, interest_amount, principal_amount,
       outstanding_principal, notes, linked_document_id, source, data_origin, is_demo)
     values ($1,$2::date,$3::date,$4,$5,$6,$7,$8,$9,$10,'manual','manual',false)
     on conflict (property_id, payment_month) where coalesce(is_demo,false) = false
     do update set
       payment_date = excluded.payment_date,
       lender = excluded.lender,
       total_payment = excluded.total_payment,
       interest_amount = excluded.interest_amount,
       principal_amount = excluded.principal_amount,
       outstanding_principal = excluded.outstanding_principal,
       notes = excluded.notes,
       linked_document_id = excluded.linked_document_id,
       updated_at = now()
     returning *`,
    [
      propertyId,
      data.payment_month,
      data.payment_date,
      data.lender,
      data.total_payment,
      data.interest_amount,
      data.principal_amount,
      data.outstanding_principal,
      data.notes,
      data.linked_document_id
    ],
    schemaName
  );
  return result.rows[0];
}

export async function updateFinancing(schemaName: string, propertyId: string, paymentId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const data = normalizeInput(input);
  const result = await query(
    `update property_financing_payments
     set payment_month = $1::date,
         payment_date = $2::date,
         lender = $3,
         total_payment = $4,
         interest_amount = $5,
         principal_amount = $6,
         outstanding_principal = $7,
         notes = $8,
         linked_document_id = $9,
         updated_at = now()
     where property_id = $10 and id = $11
     returning *`,
    [
      data.payment_month,
      data.payment_date,
      data.lender,
      data.total_payment,
      data.interest_amount,
      data.principal_amount,
      data.outstanding_principal,
      data.notes,
      data.linked_document_id,
      propertyId,
      paymentId
    ],
    schemaName
  );
  return result.rows[0] ?? null;
}

export async function deleteFinancing(schemaName: string, propertyId: string, paymentId: string) {
  await validateProperty(schemaName, propertyId);
  await query("delete from property_financing_payments where property_id = $1 and id = $2", [propertyId, paymentId], schemaName);
  return { deleted: true };
}

function normalizeInput(input: Record<string, unknown>) {
  const paymentMonth = normalizeMonth(input.payment_month ?? input.month);
  return {
    payment_month: `${paymentMonth}-01`,
    payment_date: normalizeDate(input.payment_date, `${paymentMonth}-01`),
    lender: textOrNull(input.lender),
    total_payment: normalizeAmount(input.total_payment),
    interest_amount: normalizeAmount(input.interest_amount),
    principal_amount: normalizeAmount(input.principal_amount),
    outstanding_principal: input.outstanding_principal === null || input.outstanding_principal === "" || input.outstanding_principal === undefined ? null : normalizeAmount(input.outstanding_principal),
    notes: textOrNull(input.notes),
    linked_document_id: textOrNull(input.linked_document_id)
  };
}

function normalizeMonth(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 7);
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeDate(value: unknown, fallback: string) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return fallback;
}

function normalizeAmount(value: unknown) {
  const amount = Number(String(value ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
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

function sum(items: any[], field: string) {
  return items.reduce((total, item) => total + Number(item[field] ?? 0), 0);
}
