import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { signToken } from "../utils/jwt.js";
import type { AuthUser } from "../types.js";

export async function login(email: string, password: string) {
  const result = await query<{
    id: string;
    tenant_id: string;
    email: string;
    password_hash: string;
    full_name: string | null;
    role: "admin" | "viewer";
    active: boolean;
    tenant_slug: string;
    schema_name: string;
  }>(
    `select u.*, t.slug as tenant_slug, t.schema_name
     from public.users u
     join public.tenants t on t.id = u.tenant_id
     where lower(u.email) = lower($1) and u.active = true`,
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const err = new Error("Credenciales incorrectas") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  const payload: AuthUser = {
    id: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    tenant_slug: user.tenant_slug,
    schema_name: user.schema_name
  };
  return { token: signToken(payload), user: payload };
}
