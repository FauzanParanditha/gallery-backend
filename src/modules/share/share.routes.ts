import { authGuard } from "@/middlewares/authGuard";
import { limitShareOpen } from "@/middlewares/rateLimiter";
import { Router } from "express";
import { ShareController } from "./share.controller";

export const shareRouter = Router();

// Admin: create share link sebuah album
shareRouter.post("/albums/:albumId", authGuard, ShareController.create);

// Public: buka album via slug (bisa untuk album private selama allowShare = true)
shareRouter.get("/:slug", limitShareOpen, ShareController.open);
