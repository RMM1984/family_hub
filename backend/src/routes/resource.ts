import { Router } from "express";
import multer from "multer";
import { crudController } from "../controllers/crudController.js";
import { requireRole } from "../middleware/requireRole.js";
import type { AuthedRequest } from "../types.js";
import * as crud from "../services/crudService.js";
import * as monthlyExpenses from "../services/monthlyExpenseService.js";
import * as finance from "../services/propertyFinanceService.js";

const upload = multer({ storage: multer.memoryStorage() });

export function resourceRouter(table: "properties" | "expenses" | "income" | "documents") {
  const router = Router();
  const controller = crudController(table);
  router.get("/", controller.list);
  router.post("/", requireRole("admin"), controller.create);
  if (table === "properties") {
    router.get("/:id/expenses", async (req: AuthedRequest, res) => {
      res.json({ data: await crud.listByProperty("expenses", req.schemaName!, String(req.params.id)) });
    });
    router.get("/:id/income/grouped", async (req: AuthedRequest, res) => {
      res.json({ data: await finance.groupedIncome(req.schemaName!, String(req.params.id), req.query.year) });
    });
    router.get("/:id/expenses/grouped", async (req: AuthedRequest, res) => {
      res.json({ data: await finance.groupedExpenses(req.schemaName!, String(req.params.id), req.query.year) });
    });
    router.get("/:id/documents/grouped", async (req: AuthedRequest, res) => {
      res.json({ data: await finance.groupedDocuments(req.schemaName!, String(req.params.id), req.query.year) });
    });
    router.get("/:id/expenses/monthly", async (req: AuthedRequest, res) => {
      res.json({ data: await monthlyExpenses.getMonthlyExpenses(req.schemaName!, String(req.params.id), req.query.month) });
    });
    router.put("/:id/expenses/monthly", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.json({ data: await monthlyExpenses.saveMonthlyExpenses(req.schemaName!, String(req.params.id), req.body ?? {}) });
    });
    router.get("/:id/stats/monthly", async (req: AuthedRequest, res) => {
      res.json({ data: await finance.monthlyStats(req.schemaName!, String(req.params.id), req.query.year) });
    });
    router.post("/:id/expenses", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.status(201).json({ data: await crud.createByProperty("expenses", req.schemaName!, String(req.params.id), req.body) });
    });
    router.patch("/:id/expenses/:expenseId", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.json({ data: await crud.update("expenses", req.schemaName!, String(req.params.expenseId), req.body) });
    });
    router.get("/:id/income", async (req: AuthedRequest, res) => {
      res.json({ data: await crud.listByProperty("income", req.schemaName!, String(req.params.id)) });
    });
    router.post("/:id/income", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.status(201).json({ data: await crud.createByProperty("income", req.schemaName!, String(req.params.id), req.body) });
    });
    router.patch("/:id/income/:incomeId", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.json({ data: await crud.update("income", req.schemaName!, String(req.params.incomeId), req.body) });
    });
    router.get("/:id/documents", async (req: AuthedRequest, res) => {
      res.json({ data: await crud.listByProperty("documents", req.schemaName!, String(req.params.id)) });
    });
    router.post("/:id/documents", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.status(201).json({ data: await crud.createByProperty("documents", req.schemaName!, String(req.params.id), req.body) });
    });
    router.patch("/:id/documents/:documentId", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.json({ data: await crud.update("documents", req.schemaName!, String(req.params.documentId), req.body) });
    });
    router.post("/:id/documents/:documentId/register-expense", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.status(201).json({ data: await finance.registerDocumentExpense(req.schemaName!, String(req.params.id), String(req.params.documentId), req.body ?? {}) });
    });
    router.post("/:id/documents/:documentId/register-income", requireRole("admin"), async (req: AuthedRequest, res) => {
      res.status(201).json({ data: await finance.registerDocumentIncome(req.schemaName!, String(req.params.id), String(req.params.documentId), req.body ?? {}) });
    });
  }
  router.get("/:id", controller.get);
  router.put("/:id", requireRole("admin"), controller.update);
  router.delete("/:id", requireRole("admin"), controller.remove);
  router.post("/:id/file", requireRole("admin"), upload.single("file"), async (req: AuthedRequest, res) => {
    const item = await crud.getById(table, req.schemaName!, String(req.params.id));
    if (!item) return res.status(404).json({ error: "No encontrado" });
    const propertyId = String((item as { property_id?: string }).property_id ?? req.params.id);
    const filename = req.file?.originalname ?? "archivo";
    res.json({ data: { message: "Archivo recibido", filename, path: `${req.schemaName}/properties/${propertyId}/documents/${req.params.id}/${filename}` } });
  });
  router.post("/:id/receipt", requireRole("admin"), upload.single("file"), async (req: AuthedRequest, res) => {
    const item = await crud.getById(table, req.schemaName!, String(req.params.id));
    if (!item) return res.status(404).json({ error: "No encontrado" });
    const propertyId = String((item as { property_id?: string }).property_id ?? req.params.id);
    const filename = req.file?.originalname ?? "recibo";
    res.json({ data: { message: "Recibo recibido", filename, path: `${req.schemaName}/properties/${propertyId}/expenses/${req.params.id}/${filename}` } });
  });
  return router;
}
