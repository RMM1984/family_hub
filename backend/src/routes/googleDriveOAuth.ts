import { Router } from "express";
import type { Request, Response } from "express";
import * as drive from "../services/driveService.js";

export const googleDriveOAuthRouter = Router();

googleDriveOAuthRouter.get("/connections/google-drive/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";

  if (oauthError) {
    return res.status(400).json({ error: `Google OAuth cancelado: ${oauthError}` });
  }

  if (!code || !state) {
    return res.status(400).json({ error: "Faltan code o state en el callback OAuth de Google" });
  }

  const result = await drive.completeOAuthCallback(code, state);
  res.redirect(result.redirectUrl);
});
