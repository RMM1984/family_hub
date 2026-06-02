import { Router } from "express";
import { addYears } from "date-fns";
import { query } from "../config/db.js";
import type { AuthedRequest } from "../types.js";

export const documentsExtrasRouter = Router();

documentsExtrasRouter.get("/alerts", async (req: AuthedRequest, res) => {
  const result = await query(
    "select *, expiration_date - current_date as days_to_expire from documents where active = true and expiration_date <= current_date + (alert_days_before || ' days')::interval order by expiration_date asc",
    [],
    req.schemaName
  );
  res.json({ data: result.rows });
});

documentsExtrasRouter.post("/:id/renew", async (req: AuthedRequest, res) => {
  const current = await query("select * from documents where id = $1", [req.params.id], req.schemaName);
  const doc = current.rows[0] as any;
  if (!doc) return res.status(404).json({ error: "Documento no encontrado" });
  await query("insert into document_history (document_id, year, cost, notes) values ($1,$2,$3,$4)", [doc.id, new Date().getFullYear(), doc.cost, req.body.notes ?? "Renovacion"], req.schemaName);
  const expiration = req.body.expiration_date ?? addYears(new Date(), 1).toISOString().slice(0, 10);
  const updated = await query("update documents set issue_date = current_date, expiration_date = $1, cost = coalesce($2, cost), alert_sent = false where id = $3 returning *", [expiration, req.body.cost, doc.id], req.schemaName);
  res.json({ data: updated.rows[0] });
});
