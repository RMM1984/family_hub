import { Router } from "express";
import type { Response } from "express";
import { requireRole } from "../middleware/requireRole.js";
import type { AuthedRequest } from "../types.js";
import * as airbnb from "../services/airbnbService.js";

export const airbnbRouter = Router({ mergeParams: true });

airbnbRouter.get("/reservations", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.listReservations(req.schemaName!, String(req.params.propertyId)) });
});

airbnbRouter.get("/calendar", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.getCalendar(req.schemaName!, String(req.params.propertyId)) });
});

airbnbRouter.post("/airbnb/ical", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.saveIcalUrl(req.schemaName!, String(req.params.propertyId), req.body) });
});

airbnbRouter.post("/airbnb/sync", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.syncAirbnb(req.schemaName!, String(req.params.propertyId)) });
});

airbnbRouter.get("/airbnb/stats", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.getStats(req.schemaName!, String(req.params.propertyId)) });
});

airbnbRouter.patch("/reservations/:reservationId", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.updateReservation(req.schemaName!, String(req.params.propertyId), String(req.params.reservationId), req.body) });
});

airbnbRouter.post("/reservations/:reservationId/create-income", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.status(201).json({ data: await airbnb.createIncomeFromReservation(req.schemaName!, String(req.params.propertyId), String(req.params.reservationId), req.body) });
});

airbnbRouter.patch("/operation", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.updatePropertyOperation(req.schemaName!, String(req.params.propertyId), req.body) });
});
