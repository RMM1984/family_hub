import { Router } from "express";
import type { Response } from "express";
import { requireRole } from "../middleware/requireRole.js";
import type { AuthedRequest } from "../types.js";
import * as drive from "../services/driveService.js";

export const driveRouter = Router({ mergeParams: true });

driveRouter.get("/", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.getDriveState(req.schemaName!, String(req.params.propertyId)) });
});

driveRouter.get("/auth-url", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.getAuthUrl(req.schemaName!, String(req.params.propertyId), req.user!) });
});

driveRouter.post("/connect", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.status(201).json({ data: await drive.connectFolder(req.schemaName!, String(req.params.propertyId), req.user!.id, req.body) });
});

driveRouter.post("/sync", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.syncFolder(req.schemaName!, String(req.params.propertyId)) });
});

driveRouter.post("/sync-all", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.syncAll(req.schemaName!, String(req.params.propertyId)) });
});

driveRouter.get("/folders", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.listFolders(req.schemaName!, String(req.params.propertyId)) });
});

driveRouter.post("/folders", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.status(201).json({ data: await drive.createFolder(req.schemaName!, String(req.params.propertyId), req.body) });
});

driveRouter.patch("/folders/:folderMappingId", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.updateFolder(req.schemaName!, String(req.params.propertyId), String(req.params.folderMappingId), req.body) });
});

driveRouter.delete("/folders/:folderMappingId", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.deleteFolder(req.schemaName!, String(req.params.propertyId), String(req.params.folderMappingId)) });
});

driveRouter.post("/folders/:folderMappingId/sync", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.syncFolderMapping(req.schemaName!, String(req.params.propertyId), String(req.params.folderMappingId)) });
});

driveRouter.get("/files", async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.listFiles(req.schemaName!, String(req.params.propertyId), req.query as Record<string, string | undefined>) });
});

driveRouter.patch("/files/:fileId", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.updateFile(req.schemaName!, String(req.params.propertyId), String(req.params.fileId), req.body) });
});

driveRouter.post("/files/:fileId/link-expense", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.linkExpense(req.schemaName!, String(req.params.propertyId), String(req.params.fileId), String(req.body.expense_id)) });
});

driveRouter.post("/files/:fileId/link-document", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.linkDocument(req.schemaName!, String(req.params.propertyId), String(req.params.fileId), String(req.body.document_id)) });
});

driveRouter.delete("/disconnect", requireRole("admin"), async (req: AuthedRequest, res: Response) => {
  res.json({ data: await drive.disconnect(req.schemaName!, String(req.params.propertyId)) });
});
