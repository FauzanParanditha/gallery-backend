import { getClientInfo } from "@/libs/clientInfo";
import { z } from "@/libs/z";
import type { Request, Response } from "express";
import { PublicService } from "./public.service";

export const PublicController = {
  async downloadPhoto(req: Request, res: Response) {
    const photoId = z.string().min(1).parse(req.params.photoId);
    const data = await PublicService.presignedDownloadByPhoto(
      photoId,
      getClientInfo(req)
    );
    res.json({ data }); // { url }
  },

  async shareDownload(req: Request, res: Response) {
    const slug = z.string().min(1).parse(req.params.slug);
    const photoId = z.string().min(1).parse(req.params.photoId);
    const data = await PublicService.presignedDownloadViaShare(
      slug,
      photoId,
      getClientInfo(req)
    );
    res.json({ data });
  },
};
