import { PageQuery } from "@/libs/pagination";
import { NextFunction, Request, Response } from "express";
import z from "zod";
import { CreateAlbumDto, UpdateAlbumDto } from "./album.schema";
import { AlbumService } from "./album.service";

const AlbumListQuery = PageQuery.extend({
  q: z.string().trim().min(1).optional(),
  published: z.enum(["true", "false"]).optional(), // filter isPublished
});

export const AlbumController = {
  async create(req: Request, res: Response) {
    const input = CreateAlbumDto.parse(req.body);
    const data = await AlbumService.create(input);
    res.status(201).json({ data });
  },
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, q, published } = AlbumListQuery.parse(req.query);
      const filter = {
        q,
        isPublished: published === undefined ? undefined : published === "true",
      };
      const data = await AlbumService.list({ page, limit, filter });
      res.json({ data });
    } catch (e) {
      next(e);
    }
  },
  async detail(req: Request, res: Response) {
    const data = await AlbumService.detail(req.params.id);
    res.json({ data });
  },
  async update(req: Request, res: Response) {
    const input = UpdateAlbumDto.parse(req.body);
    const data = await AlbumService.update(req.params.id, input);
    res.json({ data });
  },
  async remove(req: Request, res: Response) {
    const id = z.string().min(1).parse(req.params.id);
    await AlbumService.remove(id);
    res.status(204).send();
  },
  async publish(req: Request, res: Response) {
    const id = z.string().min(1).parse(req.params.id);
    const data = await AlbumService.publish(id);
    res.status(200).json({ data });
  },

  async unpublish(req: Request, res: Response) {
    const id = z.string().min(1).parse(req.params.id);
    const data = await AlbumService.unpublish(id);
    res.status(200).json({ data });
  },

  async setCover(req: Request, res: Response) {
    const id = z.string().min(1).parse(req.params.id);
    const photoId = z.string().min(1).parse(req.params.photoId);
    const data = await AlbumService.setCover(id, photoId);
    res.status(200).json({ data });
  },
};
