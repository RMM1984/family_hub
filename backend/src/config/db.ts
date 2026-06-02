import pg from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = [], schemaName?: string) {
  const client = await pool.connect();
  try {
    if (schemaName) {
      await client.query(`set search_path to ${pg.escapeIdentifier(schemaName)}, public`);
    }
    const result = await client.query<T>(sql, params);
    return result;
  } finally {
    client.release();
  }
}
