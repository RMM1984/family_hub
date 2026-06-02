import type { NextFunction, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import type { AuthedRequest } from "../types.js";

export function verifyJWT(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no enviado" });
  }
  try {
    req.user = verifyToken(header.slice(7));
    req.schemaName = req.user.schema_name;
    next();
  } catch {
    res.status(401).json({ error: "Token invalido o caducado" });
  }
}
