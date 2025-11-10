import { prisma } from "@/libs/prisma";
import { Prisma } from "@prisma/client";

type Filter = { q?: string; isPublished?: boolean };

function toWhere(filter: Filter) {
  const where: any = {};
  if (filter.isPublished !== undefined) where.isPublished = filter.isPublished;
  if (filter.q) {
    where.OR = [
      { title: { contains: filter.q, mode: "insensitive" } },
      { description: { contains: filter.q, mode: "insensitive" } },
      { slug: { contains: filter.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export const AlbumRepo = {
  create(data: Prisma.AlbumCreateInput) {
    return prisma.album.create({ data });
  },
  findById(id: string) {
    return prisma.album.findUnique({ where: { id } });
  },
  findBySlug(slug: string) {
    return prisma.album.findUnique({ where: { slug } });
  },
  async list({
    page,
    limit,
    filter,
  }: {
    page: number;
    limit: number;
    filter: Filter;
  }) {
    const where = toWhere(filter);
    return prisma.album.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        eventDate: true,
        isPublished: true,
        coverPhotoId: true,
        createdAt: true,
      },
    });
  },
  async count({ filter }: { filter: Filter }) {
    return prisma.album.count({ where: toWhere(filter) });
  },
  update(id: string, data: Prisma.AlbumUpdateInput) {
    return prisma.album.update({ where: { id }, data });
  },
  remove(id: string) {
    return prisma.album.delete({ where: { id } });
  },
};
