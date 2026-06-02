import type { NextFunction, Response } from "express";
import type { AuthedRequest, Role } from "../types.js";

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permisos para esta accion" });
    }
    next();
  };
}
