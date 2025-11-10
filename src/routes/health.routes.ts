import { HealthController } from "@/modules/health/health.controller";
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", HealthController.status);
healthRouter.get("/storage", HealthController.storage);
