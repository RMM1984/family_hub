import { Router } from "express";
import { query } from "../config/db.js";
import { parseAirbnbIcal } from "../utils/ical-parser.js";
import type { AuthedRequest } from "../types.js";

export const incomeExtrasRouter = Router();

incomeExtrasRouter.post("/import-csv", (_req, res) => {
  res.json({ data: { message: "Importacion CSV preparada para procesar archivos desde frontend" } });
});

incomeExtrasRouter.post("/sync-ical/:property_id", async (req: AuthedRequest, res) => {
  const property = await query("select id, airbnb_ical_url from properties where id = $1", [req.params.property_id], req.schemaName);
  const row = property.rows[0] as any;
  if (!row?.airbnb_ical_url) return res.status(400).json({ error: "La vivienda no tiene URL iCal" });
  let imported = 0;
  try {
    const events = await parseAirbnbIcal(row.airbnb_ical_url);
    for (const event of events) {
      const result = await query(
        `insert into income (property_id, source, income_date, guest_name, check_in, check_out, nights, airbnb_reservation_id, imported_from_ical)
         values ($1,'airbnb',$2,$3,$4,$5,$6,$7,true)
         on conflict (airbnb_reservation_id) do nothing returning id`,
        [row.id, event.check_in, event.guest_name, event.check_in, event.check_out, event.nights, event.uid],
        req.schemaName
      );
      imported += result.rowCount ?? 0;
    }
    await query("insert into ical_sync_log (property_id, reservations_imported) values ($1,$2)", [row.id, imported], req.schemaName);
    res.json({ data: { imported } });
  } catch (error) {
    await query("insert into ical_sync_log (property_id, reservations_imported, errors) values ($1,0,$2)", [row.id, String(error)], req.schemaName);
    res.status(500).json({ error: "No se pudo sincronizar iCal" });
  }
});
