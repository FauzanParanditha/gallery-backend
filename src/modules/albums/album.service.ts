import { BadRequest, NotFound } from "@/libs/errors";
import { prisma } from "@/libs/prisma";
import { PhotoRepo } from "../photos/photo.repo";
import { AlbumRepo } from "./album.repo";
import { CreateAlbumInput, UpdateAlbumInput } from "./album.schema";

export const AlbumService = {
  async searchAlbums(q: string, limit = 50) {
    return prisma.$queryRawUnsafe<any[]>(
      `
    SELECT *
    FROM "Album"
    WHERE "searchDoc" @@ plainto_tsquery('simple', $1)
    ORDER BY "createdAt" DESC
    LIMIT $2
    `,
      q,
      limit
    );
  },

  async create(input: CreateAlbumInput) {
    const exists = await AlbumRepo.findBySlug(input.slug);
    if (exists) throw BadRequest("Slug sudah dipakai");
    return AlbumRepo.create({
      title: input.title,
      description: input.description,
      eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
      slug: input.slug,
      isPublished: input.isPublished ?? false,
    });
  },
  async list({
    page,
    limit,
    filter,
  }: {
    page: number;
    limit: number;
    filter: { q?: string; isPublished?: boolean };
  }) {
    const [items, total] = await Promise.all([
      AlbumRepo.list({ page, limit, filter }),
      AlbumRepo.count({ filter }),
    ]);
    return {
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  },
  async detail(id: string) {
    const album = await AlbumRepo.findById(id);
    if (!album) throw NotFound("Album tidak ditemukan");
    return album;
  },
  async update(id: string, input: UpdateAlbumInput) {
    await AlbumService.detail(id);
    return AlbumRepo.update(id, {
      title: input.title,
      description: input.description,
      eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
      slug: input.slug,
      isPublished: input.isPublished,
    });
  },
  async remove(id: string) {
    await AlbumService.detail(id);
    return AlbumRepo.remove(id);
  },
  async publish(albumId: string) {
    const album = await AlbumRepo.findById(albumId);
    if (!album) throw NotFound("Album tidak ditemukan");

    // (opsional) pastikan ada minimal 1 foto processed sebelum publish
    const hasReady = await PhotoRepo.existsProcessedInAlbum(albumId);
    if (!hasReady)
      throw BadRequest("Album belum memiliki foto siap tampil (processed).");

    const updated = await AlbumRepo.update(albumId, { isPublished: true });
    return updated;
  },

  async unpublish(albumId: string) {
    const album = await AlbumRepo.findById(albumId);
    if (!album) throw NotFound("Album tidak ditemukan");

    const updated = await AlbumRepo.update(albumId, { isPublished: false });
    return updated;
  },

  async setCover(albumId: string, photoId: string) {
    const album = await AlbumRepo.findById(albumId);
    if (!album) throw NotFound("Album tidak ditemukan");

    const photo = await PhotoRepo.byId(photoId);
    if (!photo) throw NotFound("Foto tidak ditemukan");

    if (photo.albumId !== albumId) {
      throw BadRequest("Foto bukan milik album ini.");
    }

    // (opsional) syarat cover harus processed
    if (photo.status !== "processed") {
      throw BadRequest("Foto belum siap (processed) untuk dijadikan cover.");
    }

    return AlbumRepo.update(albumId, {
      coverPhoto: { connect: { id: photoId } },
    });
  },
};
