import { authGuard } from "@/middlewares/authGuard";
import { validateBody } from "@/middlewares/validate";
import { Router } from "express";
import { AlbumController } from "./album.controller";
import { CreateAlbumDto, UpdateAlbumDto } from "./album.schema";

export const albumRouter = Router();

albumRouter.get("/", authGuard, AlbumController.list); // publik/admin listing
albumRouter.get("/:id", AlbumController.detail); // detail

// admin only
albumRouter.post(
  "/",
  authGuard,
  validateBody(CreateAlbumDto),
  AlbumController.create
);
albumRouter.patch(
  "/:id",
  authGuard,
  validateBody(UpdateAlbumDto),
  AlbumController.update
);
albumRouter.delete("/:id", authGuard, AlbumController.remove);

albumRouter.post("/:id/publish", authGuard, AlbumController.publish);
albumRouter.post("/:id/unpublish", authGuard, AlbumController.unpublish);
albumRouter.post("/:id/cover/:photoId", authGuard, AlbumController.setCover);
