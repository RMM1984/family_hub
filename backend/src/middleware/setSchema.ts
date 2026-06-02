import type { NextFunction, Response } from "express";
import type { AuthedRequest } from "../types.js";

export function setSchema(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.schema_name) {
    return res.status(401).json({ error: "Tenant no resuelto" });
  }
  req.schemaName = req.user.schema_name;
  next();
}
