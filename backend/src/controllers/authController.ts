import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/authService.js";
import { ok } from "../utils/response.js";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  ok(res, await authService.login(input.email, input.password));
}

export async function refresh(req: Request, res: Response) {
  ok(res, { message: "Token vigente" });
}

export async function logout(_req: Request, res: Response) {
  ok(res, { message: "Sesion cerrada" });
}
