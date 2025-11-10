import { prisma } from "@/libs/prisma";
import { Prisma } from "@prisma/client";

export const PhotoRepo = {
  create: (data: Prisma.PhotoUncheckedCreateInput) =>
    prisma.photo.create({ data }),
  byId: (id: string) => prisma.photo.findUnique({ where: { id } }),
  listByAlbum: (albumId: string) =>
    prisma.photo.findMany({
      where: { albumId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  update: (id: string, data: any) =>
    prisma.photo.update({ where: { id }, data }),
  remove: (id: string) => prisma.photo.delete({ where: { id } }),
  findByAlbumAndKey(albumId: string, keyOriginal: string) {
    return prisma.photo.findFirst({ where: { albumId, keyOriginal } });
  },
  async existsProcessedInAlbum(albumId: string) {
    const x = await prisma.photo.findFirst({
      where: { albumId, status: "processed" },
      select: { id: true },
    });
    return Boolean(x);
  },
};
