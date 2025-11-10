import { buildOpenApi } from "@/docs/openapi";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";

export const docsRouter = Router();
const doc = buildOpenApi();
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(doc));
