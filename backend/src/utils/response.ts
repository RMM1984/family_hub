import type { Response } from "express";

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ data });
}

export function created(res: Response, data: unknown) {
  return ok(res, data, 201);
}
