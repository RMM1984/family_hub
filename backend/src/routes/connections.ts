import { Router } from "express";
import type { Response } from "express";
import type { AuthedRequest } from "../types.js";
import * as drive from "../services/driveService.js";
import * as pricelabs from "../services/pricelabsService.js";
import { requireRole } from "../middleware/requireRole.js";

export const connectionsRouter = Router();

connectionsRouter.get("/", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.listConnections(req.schemaName!) });
});

connectionsRouter.get("/google-drive", async (req: AuthedRequest, res: Response) => {
  const connections = await drive.listConnections(req.schemaName!);
  res.json({ data: connections.google_drive });
});

connectionsRouter.get("/google-drive/folders", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.listGoogleDriveFolders(req.schemaName!) });
});

connectionsRouter.get("/pricelabs", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await pricelabs.getPriceLabsConnection(req.schemaName!) });
});

connectionsRouter.post("/pricelabs/api-key", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await pricelabs.saveApiKey(req.schemaName!, req.user!.id, req.body) });
});

connectionsRouter.post("/pricelabs/test", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await pricelabs.testConnection(req.schemaName!) });
});

connectionsRouter.get("/pricelabs/listings", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await pricelabs.listListings(req.schemaName!, req.query.refresh === "true") });
});

connectionsRouter.post("/pricelabs/mappings", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.status(201).json({ data: await pricelabs.mapListing(req.schemaName!, req.body) });
});

connectionsRouter.delete("/pricelabs/mappings/:mappingId", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await pricelabs.deleteMapping(req.schemaName!, String(req.params.mappingId)) });
});
