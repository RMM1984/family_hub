import type { Request } from "express";

export type Role = "admin" | "viewer";

export interface AuthUser {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  tenant_slug: string;
  schema_name: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  schemaName?: string;
}
