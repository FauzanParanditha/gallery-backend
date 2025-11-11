import { buildOpenApi } from "@/docs/openapi";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";

export const docsRouter = Router();
const doc = buildOpenApi();
docsRouter.get("/openapi.json", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // (Opsional) Cache 1 menit:
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).send(doc);
});

docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(doc));
