import { Forbidden, NotFound } from "@/libs/errors";
import { prisma } from "@/libs/prisma";
import { randomSlug } from "@/libs/slug";

export const ShareService = {
  async createAlbumShareLink(albumId: string, note?: string, expiresAt?: Date) {
    const album = await prisma.album.findUnique({
      where: { id: albumId },

      // ADD ON:
      // include: { albumPrivacy: true },
    });
    if (!album) throw NotFound("Album tidak ditemukan");

    // ADD ON:
    // const privacy = album.albumPrivacy ?? { allowShare: true };
    // if (privacy.allowShare === false) throw Forbidden("Share dinonaktifkan");

    const slug = randomSlug(16);
    const link = await prisma.shareLink.create({
      data: { albumId: album.id, slug, note, expiresAt: expiresAt ?? null },
    });
    return link;
  },

  async getAlbumByShareSlug(slug: string) {
    const link = await prisma.shareLink.findUnique({
      where: { slug },

      // ADD ON:
      // include: {
      //   album: {
      //     include: {
      //       albumPrivacy: true,
      //       photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      //     },
      //   },
      // },
    });
    if (!link) throw NotFound("Share link tidak ditemukan");
    if (link.expiresAt && link.expiresAt < new Date())
      throw Forbidden("Share link kedaluwarsa");

    // ADD ON:
    // const album = link.album;
    // const privacy = album.albumPrivacy ?? { allowShare: true };
    // if (privacy.allowShare === false) throw Forbidden("Share dinonaktifkan");

    const album = await prisma.album.findUnique({
      where: { id: link.albumId },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverPhotoId: true,
        isPublished: true, // boleh unpublished saat akses via share
        photos: {
          where: { status: "processed" },
          select: {
            id: true,
            keyThumb: true,
            keyOriginal: true, // simpan kalau mau fitur download publik
            width: true,
            height: true,
            caption: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!album) throw NotFound("Album tidak ditemukan");

    return { link, album };
  },
};
