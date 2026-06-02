import { Router } from "express";
import * as controller from "../controllers/dashboardController.js";

export const dashboardRouter = Router();
dashboardRouter.get("/summary", controller.summary);
dashboardRouter.get("/comparison", controller.comparison);
dashboardRouter.get("/property/:id", controller.property);
