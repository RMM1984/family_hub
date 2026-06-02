import type { Response } from "express";
import type { AuthedRequest } from "../types.js";
import * as crud from "../services/crudService.js";
import { created, ok } from "../utils/response.js";

export function crudController(table: "properties" | "expenses" | "income" | "documents") {
  return {
    async list(req: AuthedRequest, res: Response) {
      ok(res, await crud.list(table, req.schemaName!, req.query as Record<string, string | undefined>));
    },
    async get(req: AuthedRequest, res: Response) {
      const item = await crud.getById(table, req.schemaName!, String(req.params.id));
      if (!item) return res.status(404).json({ error: "No encontrado" });
      ok(res, item);
    },
    async create(req: AuthedRequest, res: Response) {
      created(res, await crud.create(table, req.schemaName!, req.body));
    },
    async update(req: AuthedRequest, res: Response) {
      const item = await crud.update(table, req.schemaName!, String(req.params.id), req.body);
      if (!item) return res.status(404).json({ error: "No encontrado" });
      ok(res, item);
    },
    async remove(req: AuthedRequest, res: Response) {
      await crud.remove(table, req.schemaName!, String(req.params.id));
      ok(res, { message: "Eliminado" });
    }
  };
}
