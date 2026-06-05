import { query } from "../config/db.js";

const allowedTables = new Set(["properties", "expenses", "income", "documents"]);
const propertyScopedTables = new Set(["expenses", "income", "documents"]);

function assertTable(table: string) {
  if (!allowedTables.has(table)) throw new Error("Tabla no permitida");
}

function allowedFiltersFor(table: string) {
  if (table === "properties") return new Set(["type", "operation_type", "rental_type", "airbnb_enabled"]);
  if (table === "expenses") return new Set(["property_id", "category"]);
  if (table === "income") return new Set(["property_id", "source"]);
  if (table === "documents") return new Set(["property_id", "type"]);
  return new Set<string>();
}

export async function list(table: string, schemaName: string, filters: Record<string, string | undefined>) {
  assertTable(table);
  const clauses: string[] = [];
  const params: unknown[] = [];
  const allowedFilters = allowedFiltersFor(table);
  for (const [key, value] of Object.entries(filters)) {
    if (!value || !allowedFilters.has(key)) continue;
    params.push(value);
    clauses.push(`${key} = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`${table === "expenses" ? "expense_date" : table === "income" ? "income_date" : "created_at"} >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`${table === "expenses" ? "expense_date" : table === "income" ? "income_date" : "created_at"} <= $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  if (table === "properties") {
    const result = await query(
      `select p.*,
        coalesce(mi.month_income, 0) as month_income,
        coalesce(me.month_expenses, 0) as month_expenses,
        coalesce(mi.month_income, 0) - coalesce(me.month_expenses, 0) as month_profit,
        da.next_document_expiration,
        da.next_document_title,
        nr.next_check_in,
        nr.next_guest_name
       from properties p
       left join (
         select property_id, sum(amount) as month_income
         from income
         where date_trunc('month', income_date::timestamp) = date_trunc('month', current_date::timestamp)
         group by property_id
       ) mi on mi.property_id = p.id
       left join (
         select property_id, sum(amount) as month_expenses
         from expenses
         where date_trunc('month', expense_date::timestamp) = date_trunc('month', current_date::timestamp)
         group by property_id
       ) me on me.property_id = p.id
       left join lateral (
         select title as next_document_title, expiration_date as next_document_expiration
         from documents
         where property_id = p.id and active = true and expiration_date >= current_date
         order by expiration_date asc
         limit 1
       ) da on true
       left join lateral (
         select guest_name as next_guest_name, check_in as next_check_in
         from income
         where property_id = p.id and check_in >= current_date
         order by check_in asc
         limit 1
       ) nr on true
       ${where}
       order by p.created_at desc`,
      params,
      schemaName
    );
    return result.rows;
  }
  const select = propertyScopedTables.has(table)
    ? `${table}.*, p.alias as property_alias, p.address as property_address`
    : `${table}.*`;
  const join = propertyScopedTables.has(table) ? `join properties p on p.id = ${table}.property_id` : "";
  const result = await query(`select ${select} from ${table} ${join} ${where} order by ${table}.created_at desc`, params, schemaName);
  return result.rows;
}

export async function getById(table: string, schemaName: string, id: string) {
  assertTable(table);
  const select = propertyScopedTables.has(table)
    ? `${table}.*, p.alias as property_alias, p.address as property_address`
    : `${table}.*`;
  const join = propertyScopedTables.has(table) ? `join properties p on p.id = ${table}.property_id` : "";
  const result = await query(`select ${select} from ${table} ${join} where ${table}.id = $1`, [id], schemaName);
  return result.rows[0] ?? null;
}

export async function create(table: string, schemaName: string, data: Record<string, unknown>) {
  assertTable(table);
  await validateScopedProperty(table, schemaName, data.property_id);
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  const values = keys.map((key) => data[key]);
  const placeholders = keys.map((_, index) => `$${index + 1}`);
  const result = await query(
    `insert into ${table} (${keys.join(",")}) values (${placeholders.join(",")}) returning *`,
    values,
    schemaName
  );
  return result.rows[0];
}

export async function update(table: string, schemaName: string, id: string, data: Record<string, unknown>) {
  assertTable(table);
  if (propertyScopedTables.has(table) && data.property_id !== undefined) {
    await validateScopedProperty(table, schemaName, data.property_id);
  }
  const keys = Object.keys(data).filter((key) => data[key] !== undefined && key !== "id");
  const values = keys.map((key) => data[key]);
  const sets = keys.map((key, index) => `${key} = $${index + 1}`);
  values.push(id);
  const result = await query(`update ${table} set ${sets.join(", ")} where id = $${values.length} returning *`, values, schemaName);
  return result.rows[0] ?? null;
}

export async function remove(table: string, schemaName: string, id: string) {
  assertTable(table);
  await query(`delete from ${table} where id = $1`, [id], schemaName);
}

export async function validateProperty(schemaName: string, propertyId: unknown) {
  if (typeof propertyId !== "string" || propertyId.length === 0) {
    const err = new Error("La vivienda es obligatoria") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const result = await query("select id from properties where id = $1 and active = true", [propertyId], schemaName);
  if (!result.rows[0]) {
    const err = new Error("La vivienda no existe en este tenant") as Error & { status: number };
    err.status = 404;
    throw err;
  }
}

async function validateScopedProperty(table: string, schemaName: string, propertyId: unknown) {
  if (!propertyScopedTables.has(table)) return;
  await validateProperty(schemaName, propertyId);
}

export async function listByProperty(table: "expenses" | "income" | "documents", schemaName: string, propertyId: string) {
  await validateProperty(schemaName, propertyId);
  return list(table, schemaName, { property_id: propertyId });
}

export async function createByProperty(table: "expenses" | "income" | "documents", schemaName: string, propertyId: string, data: Record<string, unknown>) {
  await validateProperty(schemaName, propertyId);
  return create(table, schemaName, { ...data, property_id: propertyId });
}
