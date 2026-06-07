import { query } from "../config/db.js";
import { validateProperty } from "./crudService.js";

export async function groupedIncome(schemaName: string, propertyId: string, yearInput: unknown) {
  await validateProperty(schemaName, propertyId);
  const year = normalizeYear(yearInput);
  const result = await query(
    `select *
     from income
     where property_id = $1
       and income_date >= $2::date
       and income_date < ($2::date + interval '1 year')
       and coalesce(is_demo,false) = false
     order by income_date asc, created_at asc`,
    [propertyId, `${year}-01-01`],
    schemaName
  );
  return groupRows(year, result.rows, "income_date", "income_total", (row) => row.amount_status !== "missing" && row.amount !== null && row.amount !== undefined);
}

export async function groupedExpenses(schemaName: string, propertyId: string, yearInput: unknown) {
  await validateProperty(schemaName, propertyId);
  const year = normalizeYear(yearInput);
  const result = await query(
    `select *
     from expenses
     where property_id = $1
       and expense_date >= $2::date
       and expense_date < ($2::date + interval '1 year')
       and coalesce(is_demo,false) = false
       and category = any($3::text[])
     order by expense_date asc, created_at asc`,
    [propertyId, `${year}-01-01`, ["electricity","water","gas","internet","cleaning","supplies","maintenance","repairs","renovation","furniture","other"]],
    schemaName
  );
  return groupRows(year, result.rows, "expense_date", "expense_total", () => true);
}

export async function groupedDocuments(schemaName: string, propertyId: string, yearInput: unknown) {
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
  return groupRows(year, result.rows, "document_date", "document_total", () => true, "amount");
}

export async function monthlyStats(schemaName: string, propertyId: string, yearInput: unknown) {
  await validateProperty(schemaName, propertyId);
  const year = normalizeYear(yearInput);
  const [income, expenses, pending] = await Promise.all([
    query(
      `select to_char(date_trunc('month', income_date::timestamp), 'YYYY-MM') as month,
              coalesce(sum(amount),0)::numeric as total
       from income
       where property_id = $1 and income_date >= $2::date and income_date < ($2::date + interval '1 year')
         and amount is not null and coalesce(is_demo,false) = false and coalesce(amount_status,'manual') <> 'missing'
       group by 1`,
      [propertyId, `${year}-01-01`],
      schemaName
    ),
    query(
      `select to_char(date_trunc('month', expense_date::timestamp), 'YYYY-MM') as month,
              coalesce(sum(amount),0)::numeric as total
       from expenses
       where property_id = $1 and expense_date >= $2::date and expense_date < ($2::date + interval '1 year')
         and coalesce(is_demo,false) = false
       group by 1`,
      [propertyId, `${year}-01-01`],
      schemaName
    ),
    query(
      `select to_char(date_trunc('month', income_date::timestamp), 'YYYY-MM') as month,
              count(*)::int as count
       from income
       where property_id = $1 and income_date >= $2::date and income_date < ($2::date + interval '1 year')
         and coalesce(is_demo,false) = false and (amount_status = 'missing' or amount is null)
       group by 1`,
      [propertyId, `${year}-01-01`],
      schemaName
    )
  ]);
  const incomeByMonth = new Map(income.rows.map((row: any) => [row.month, Number(row.total ?? 0)]));
  const expenseByMonth = new Map(expenses.rows.map((row: any) => [row.month, Number(row.total ?? 0)]));
  const pendingByMonth = new Map(pending.rows.map((row: any) => [row.month, Number(row.count ?? 0)]));
  return {
    year,
    months: Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, "0")}`;
      const incomeTotal = incomeByMonth.get(month) ?? 0;
      const expenseTotal = expenseByMonth.get(month) ?? 0;
      const netProfit = incomeTotal - expenseTotal;
      return {
        month,
        label: monthLabel(month),
        income_total: incomeTotal,
        expense_total: expenseTotal,
        net_profit: netProfit,
        expense_ratio: incomeTotal > 0 ? Number(((expenseTotal / incomeTotal) * 100).toFixed(2)) : null,
        profit_margin: incomeTotal > 0 ? Number(((netProfit / incomeTotal) * 100).toFixed(2)) : null,
        pending_income_count: pendingByMonth.get(month) ?? 0
      };
    })
  };
}

export async function registerDocumentExpense(schemaName: string, propertyId: string, documentId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const document = await getDocument(schemaName, propertyId, documentId);
  const amount = normalizeAmount(input.amount ?? document.amount ?? document.cost);
  const date = toIsoDate(input.expense_date ?? document.document_date ?? document.expiration_date ?? new Date());
  const result = await query(
    `insert into expenses (property_id, category, provider, amount, currency, expense_date, description, source, data_origin, linked_document_id)
     values ($1,$2,$3,$4,'EUR',$5,$6,'manual','document_manual',$7)
     returning *`,
    [propertyId, normalizeExpenseCategory(input.category), document.provider ?? null, amount, date, document.title, document.id],
    schemaName
  );
  await query("update documents set linked_expense_id = $1, status = 'linked', updated_at = now() where property_id = $2 and id = $3", [result.rows[0].id, propertyId, documentId], schemaName);
  return result.rows[0];
}

export async function registerDocumentIncome(schemaName: string, propertyId: string, documentId: string, input: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  const document = await getDocument(schemaName, propertyId, documentId);
  const amount = normalizeAmount(input.amount ?? document.amount ?? document.cost);
  const date = toIsoDate(input.income_date ?? document.document_date ?? new Date());
  const result = await query(
    `insert into income (property_id, source, amount, currency, income_date, description, amount_status, data_origin, is_demo)
     values ($1,$2,$3,'EUR',$4,$5,'manual','document_manual',false)
     returning *`,
    [propertyId, String(input.source ?? "other"), amount, date, document.title],
    schemaName
  );
  await query("update documents set linked_income_id = $1, status = 'linked', updated_at = now() where property_id = $2 and id = $3", [result.rows[0].id, propertyId, documentId], schemaName);
  return result.rows[0];
}

async function getDocument(schemaName: string, propertyId: string, documentId: string) {
  const result = await query("select * from documents where property_id = $1 and id = $2", [propertyId, documentId], schemaName);
  if (!result.rows[0]) {
    const err = new Error("Documento no encontrado en esta vivienda") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return result.rows[0] as any;
}

function groupRows(year: number, rows: any[], dateField: string, totalField: string, includeInTotal: (row: any) => boolean, amountField = "amount") {
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const items = rows.filter((row) => toMonth(row[dateField] ?? row.created_at) === month);
    const total = items.filter(includeInTotal).reduce((sum, row) => sum + Number(row[amountField] ?? row.cost ?? 0), 0);
    const pending = items.filter((row) => row.amount_status === "missing" || row.amount === null || row.amount === undefined).length;
    return { month, label: monthLabel(month), [totalField]: total, pending_amount_count: pending, items };
  });
  const yearTotal = months.reduce((sum: number, row: any) => sum + Number(row[totalField] ?? 0), 0);
  return { year, months, year_total: yearTotal };
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

function normalizeAmount(value: unknown) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function toIsoDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function normalizeExpenseCategory(value: unknown) {
  const raw = String(value ?? "other");
  const allowed = new Set(["electricity","water","gas","internet","community","cleaning","supplies","supermarket","ibi","garbage","home_insurance","insurance","taxes","maintenance","repairs","renovation","furniture","mortgage","other"]);
  return allowed.has(raw) ? raw : "other";
}
