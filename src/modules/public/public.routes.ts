import {
  limitPublicDownload,
  limitShareDownload,
} from "@/middlewares/rateLimiter";
import { Router } from "express";
import { PublicController } from "./public.controller";

export const publicRouter = Router();

// Download publik langsung by photoId (hormati privacy & published)
publicRouter.post(
  "/photos/:photoId/download",
  limitPublicDownload,
  PublicController.downloadPhoto
);
publicRouter.post(
  "/share/:slug/photos/:photoId/download",
  limitShareDownload,
  PublicController.shareDownload
);
