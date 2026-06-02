import { query } from "../config/db.js";

const allowedTables = new Set(["properties", "expenses", "income", "documents"]);

function assertTable(table: string) {
  if (!allowedTables.has(table)) throw new Error("Tabla no permitida");
}

export async function list(table: string, schemaName: string, filters: Record<string, string | undefined>) {
  assertTable(table);
  const clauses: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (!value || !["property_id", "category", "type", "source"].includes(key)) continue;
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
  const result = await query(`select * from ${table} ${where} order by created_at desc`, params, schemaName);
  return result.rows;
}

export async function getById(table: string, schemaName: string, id: string) {
  assertTable(table);
  const result = await query(`select * from ${table} where id = $1`, [id], schemaName);
  return result.rows[0] ?? null;
}

export async function create(table: string, schemaName: string, data: Record<string, unknown>) {
  assertTable(table);
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
