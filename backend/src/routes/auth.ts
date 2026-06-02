import { Router } from "express";
import * as controller from "../controllers/authController.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

export const authRouter = Router();
authRouter.post("/login", controller.login);
authRouter.post("/refresh", verifyJWT, controller.refresh);
authRouter.post("/logout", verifyJWT, controller.logout);
