import { getClientInfo } from "@/libs/clientInfo";
import { bumpPresignCounter } from "@/libs/metrics";
import { z } from "@/libs/z";
import type { Request, Response } from "express";
import { ConfirmDto, PresignDto, UpdatePhotoDto } from "./photo.schema";
import { PhotoService } from "./photo.service";

export const PhotoController = {
  async presign(req: Request, res: Response) {
    const input = PresignDto.parse(req.body);

    // identitas untuk metering: pakai user.id (login), fallback IP
    const userId = (req as any).user?.id as string | undefined;
    const { ipAddress } = getClientInfo(req);
    const userOrIp = userId ?? (ipAddress || "unknown");

    // panggil service untuk dapat upload url
    const data = await PhotoService.presign(input);

    // bump counter (non-blocking tapi tetap await supaya konsisten)
    await bumpPresignCounter(userOrIp, input.albumId);

    res.status(201).json({ data });
  },

  async confirm(req: Request, res: Response) {
    const input = ConfirmDto.parse(req.body);
    const data = await PhotoService.confirm(input);
    res.status(201).json({ data });
  },

  async list(req: Request, res: Response) {
    const albumId = z.string().min(1).parse(req.params.albumId);
    const data = await PhotoService.list(albumId);
    res.json({ data });
  },

  async update(req: Request, res: Response) {
    const id = z.string().min(1).parse(req.params.id);
    const input = UpdatePhotoDto.parse(req.body);
    const data = await PhotoService.update(id, input);
    res.json({ data });
  },

  async remove(req: Request, res: Response) {
    const id = z.string().min(1).parse(req.params.id);
    await PhotoService.remove(id);
    res.status(204).send();
  },
};
