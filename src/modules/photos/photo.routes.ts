import { authGuard } from "@/middlewares/authGuard";
import { limitPresign } from "@/middlewares/rateLimiter";
import { validateBody } from "@/middlewares/validate";
import { Router } from "express";
import { PhotoController } from "./photo.controller";
import { ConfirmDto, PresignDto, UpdatePhotoDto } from "./photo.schema";

export const photoRouter = Router();

// admin only
photoRouter.post(
  "/presign",
  authGuard,
  limitPresign,
  validateBody(PresignDto),
  PhotoController.presign
);
photoRouter.post(
  "/confirm",
  authGuard,
  validateBody(ConfirmDto),
  PhotoController.confirm
);
photoRouter.get("/album/:albumId", authGuard, PhotoController.list);
photoRouter.patch(
  "/:id",
  authGuard,
  validateBody(UpdatePhotoDto),
  PhotoController.update
);
photoRouter.delete("/:id", authGuard, PhotoController.remove);
