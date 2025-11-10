import { corsMw } from "@/middlewares/cors";
import { errorHandler, notFoundHandler } from "@/middlewares/errorHandler";
import { requestId } from "@/middlewares/requestId";
import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import hpp from "hpp";
import { router } from "./routes";
import { healthRouter } from "./routes/health.routes";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(hpp());
  app.use(compression());
  app.use(corsMw);
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use(requestId);

  // app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use("/v1", router);
  app.use("/health", healthRouter);

  // 404 handler
  app.use(notFoundHandler);

  // error handler
  app.use(errorHandler);
  return app;
}
