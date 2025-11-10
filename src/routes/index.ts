import { albumRouter } from "@/modules/albums/album.routes";
import { authRouter } from "@/modules/auth/auth.routes";
import { metricsRouter } from "@/modules/metrics/metrics.route";
import { photoRouter } from "@/modules/photos/photo.routes";
import { publicRouter } from "@/modules/public/public.routes";
import { shareRouter } from "@/modules/share/share.routes";
import { Router } from "express";
import { docsRouter } from "./docs";

export const router = Router();
if (process.env.NODE_ENV !== "production") router.use("/docs", docsRouter);
router.use("/metrics", metricsRouter);

router.use("/auth", authRouter);

router.use("/albums", albumRouter);
router.use("/photos", photoRouter);

router.use("/public", publicRouter);
router.use("/share", shareRouter);
