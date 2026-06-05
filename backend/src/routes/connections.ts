import { Router } from "express";
import type { Response } from "express";
import type { AuthedRequest } from "../types.js";
import * as drive from "../services/driveService.js";

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
