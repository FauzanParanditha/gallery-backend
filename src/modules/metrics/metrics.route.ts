import { authGuard } from "@/middlewares/authGuard";
import { Router } from "express";
import { MetricsController } from "./metrics.controller";

export const metricsRouter = Router();
metricsRouter.get(
  "/presign-user-today",
  authGuard,
  MetricsController.presignUserToday
);
