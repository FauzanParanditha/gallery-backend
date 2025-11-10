import { BadRequest, Forbidden, NotFound } from "@/libs/errors";
import { prisma } from "@/libs/prisma";
import { presignGet } from "@/libs/s3";

async function presignedDownloadViaShare(
  slug: string,
  photoId: string,
  client: { ipAddress?: string; userAgent?: string }
) {
  const link = await prisma.shareLink.findUnique({
    where: { slug },
    select: { id: true, albumId: true, expiresAt: true },
  });
  if (!link) throw NotFound("Share link tidak ditemukan");
  if (link.expiresAt && link.expiresAt < new Date()) {
    const e: any = BadRequest("Share link kedaluwarsa");
    e.status = 410;
    throw e;
  }

  // Foto milik album & processed
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, albumId: link.albumId },
    select: {
      id: true,
      albumId: true,
      keyOriginal: true,
      status: true,
      mimeType: true,
    },
  });
  if (!photo) throw NotFound("Foto tidak ditemukan");
  if (photo.status !== "processed") throw Forbidden("Foto belum siap");
  if (!photo.keyOriginal) throw BadRequest("Key file tidak tersedia");

  const url = await presignGet(photo.keyOriginal, 180); // 3 menit cukup

  // logging non-blocking
  prisma.downloadLog
    .create({
      data: {
        albumId: photo.albumId,
        photoId: photo.id,
        ipAddress: client.ipAddress,
        userAgent: client.userAgent,
        via: "share_link",
      },
    })
    .catch(() => {});

  return { url, mimeType: photo.mimeType ?? "application/octet-stream" };
}

export const PublicService = {
  async presignedDownloadByPhoto(
    photoId: string,
    client: { ipAddress?: string; userAgent?: string }
  ) {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        albumId: true,
        keyOriginal: true,
        status: true,
        mimeType: true,
        album: { select: { isPublished: true } },
      },
    });
    if (!photo) throw NotFound("Foto tidak ditemukan");
    if (photo.status !== "processed") throw Forbidden("Foto belum siap");
    if (!photo.album?.isPublished)
      throw Forbidden("Album belum dipublikasikan");
    if (!photo.keyOriginal) throw BadRequest("Key file tidak tersedia");

    const url = await presignGet(photo.keyOriginal, 180);

    prisma.downloadLog
      .create({
        data: {
          albumId: photo.albumId,
          photoId: photo.id,
          ipAddress: client.ipAddress,
          userAgent: client.userAgent,
          via: "direct",
        },
      })
      .catch(() => {});

    return { url, mimeType: photo.mimeType ?? "application/octet-stream" };
  },
  presignedDownloadViaShare,
};
