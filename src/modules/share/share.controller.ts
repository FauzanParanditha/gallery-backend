import { z } from "@/libs/z";
import type { Request, Response } from "express";
import { ShareService } from "./share.service";

const CreateShareDto = z.object({
  note: z.string().optional(),
  expiresAt: z.string().datetime().optional(), // ISO
});

export const ShareController = {
  // admin creates share link
  async create(req: Request, res: Response) {
    const albumId = z.string().min(1).parse(req.params.albumId);
    const { note, expiresAt } = CreateShareDto.parse(req.body);
    const link = await ShareService.createAlbumShareLink(
      albumId,
      note,
      expiresAt ? new Date(expiresAt) : undefined
    );
    res.status(201).json({ data: link });
  },

  // public: open album via share slug
  async open(req: Request, res: Response) {
    const slug = z.string().min(1).parse(req.params.slug);
    const data = await ShareService.getAlbumByShareSlug(slug);
    res.json({ data });
  },
};
