import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
import { requireRole } from "../middleware/requireRole.js";
import type { AuthedRequest } from "../types.js";
import * as airbnb from "../services/airbnbService.js";
import * as earnings from "../services/airbnbEarningsService.js";

export const airbnbRouter = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

airbnbRouter.delete("/airbnb/ical", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.disconnectAirbnb(req.schemaName!, String(req.params.propertyId)) });
});

airbnbRouter.get("/airbnb/stats", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.getStats(req.schemaName!, String(req.params.propertyId)) });
});

airbnbRouter.post("/airbnb/earnings/import-csv", requireRole("admin"), upload.single("file"), async (req: AuthedRequest, res: Response) => {
  res.status(201).json({ data: await earnings.importCsv(req.schemaName!, String(req.params.propertyId), req.user?.id, req.file) });
});

airbnbRouter.get("/airbnb/earnings/imports/:importId", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await earnings.getImport(req.schemaName!, String(req.params.propertyId), String(req.params.importId)) });
});

airbnbRouter.post("/airbnb/earnings/imports/:importId/apply", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await earnings.applyImport(req.schemaName!, String(req.params.propertyId), String(req.params.importId), req.body ?? {}) });
});

airbnbRouter.patch("/reservations/:reservationId", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.updateReservation(req.schemaName!, String(req.params.propertyId), String(req.params.reservationId), req.body) });
});

airbnbRouter.post("/reservations/:reservationId/create-income", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.status(201).json({ data: await airbnb.createIncomeFromReservation(req.schemaName!, String(req.params.propertyId), String(req.params.reservationId), req.body) });
});

airbnbRouter.patch("/reservations/:reservationId/amount", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.updateReservationAmount(req.schemaName!, String(req.params.propertyId), String(req.params.reservationId), req.body) });
});

airbnbRouter.patch("/reservations/:reservationId/guest-count", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.updateGuestCount(req.schemaName!, String(req.params.propertyId), String(req.params.reservationId), req.body) });
});

airbnbRouter.patch("/operation", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await airbnb.updatePropertyOperation(req.schemaName!, String(req.params.propertyId), req.body) });
});
