import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { env } from "../config/env.js";

export async function runMigrations(schemaName?: string) {
  const client = new pg.Client({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
  });
  await client.connect();
  try {
    const migrationsDir = path.join(process.cwd(), "src", "db", "migrations");
    const publicSql = await fs.readFile(path.join(migrationsDir, "000_public_schema.sql"), "utf8");
    await client.query(publicSql);
    if (schemaName) {
      await client.query(`create schema if not exists ${pg.escapeIdentifier(schemaName)}`);
      await client.query(`set search_path to ${pg.escapeIdentifier(schemaName)}, public`);
      const tenantSql = await fs.readFile(path.join(migrationsDir, "001_tenant_schema.sql"), "utf8");
      await client.query(tenantSql);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  runMigrations(process.argv[2]).then(() => console.log("Migraciones aplicadas"));
}
