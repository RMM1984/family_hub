import type { Response } from "express";
import type { AuthedRequest } from "../types.js";
import { getSummary } from "../services/dashboardService.js";
import { ok } from "../utils/response.js";

export async function summary(req: AuthedRequest, res: Response) {
  ok(res, await getSummary(req.schemaName!));
}

export async function comparison(req: AuthedRequest, res: Response) {
  const data = await getSummary(req.schemaName!);
  ok(res, data.properties);
}

export async function property(req: AuthedRequest, res: Response) {
  ok(res, { id: req.params.id, summary: await getSummary(req.schemaName!) });
}
