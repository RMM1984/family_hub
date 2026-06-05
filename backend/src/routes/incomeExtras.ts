import { Router } from "express";
import * as airbnb from "../services/airbnbService.js";
import type { AuthedRequest } from "../types.js";

export const incomeExtrasRouter = Router();

incomeExtrasRouter.post("/import-csv", (_req, res) => {
  res.json({ data: { message: "Importacion CSV preparada para procesar archivos desde frontend" } });
});

incomeExtrasRouter.post("/sync-ical/:property_id", async (req: AuthedRequest, res) => {
  res.json({ data: await airbnb.syncAirbnb(req.schemaName!, String(req.params.property_id)) });
});
