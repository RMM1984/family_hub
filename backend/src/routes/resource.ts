import { Router } from "express";
import multer from "multer";
import { crudController } from "../controllers/crudController.js";
import { requireRole } from "../middleware/requireRole.js";

const upload = multer({ storage: multer.memoryStorage() });

export function resourceRouter(table: "properties" | "expenses" | "income" | "documents") {
  const router = Router();
  const controller = crudController(table);
  router.get("/", controller.list);
  router.post("/", requireRole("admin"), controller.create);
  router.get("/:id", controller.get);
  router.put("/:id", requireRole("admin"), controller.update);
  router.delete("/:id", requireRole("admin"), controller.remove);
  router.post("/:id/file", requireRole("admin"), upload.single("file"), (req, res) => {
    res.json({ data: { message: "Archivo recibido", filename: req.file?.originalname ?? null } });
  });
  router.post("/:id/receipt", requireRole("admin"), upload.single("file"), (req, res) => {
    res.json({ data: { message: "Recibo recibido", filename: req.file?.originalname ?? null } });
  });
  return router;
}
