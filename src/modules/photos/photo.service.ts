import { NotFound } from "@/libs/errors";
import { imageQueue } from "@/libs/queue";
import { deleteObjectsBulk, presignPut } from "@/libs/s3";
import { rewritePresignForTest } from "@/utils/rewritePresign";
import { randomUUID } from "crypto";
import path from "path";
import z from "zod";
import { AlbumRepo } from "../albums/album.repo";
import { PhotoRepo } from "./photo.repo";
import { ConfirmDto, PresignDto, UpdatePhotoDto } from "./photo.schema";

const ORIGINAL_PREFIX = "albums";

export const PhotoService = {
  async presign(input: z.infer<typeof PresignDto>) {
    const album = await AlbumRepo.findById(input.albumId);
    if (!album) throw NotFound("Album tidak ditemukan");

    // Normalisasi ekstensi dari fileName (opsional: derive dari contentType jika kosong)
    let ext = (path.extname(input.fileName || "") || "").toLowerCase();
    if (!ext) {
      // fallback ringan berdasar contentType
      if (input.contentType === "image/webp") ext = ".webp";
      else if (input.contentType === "image/png") ext = ".png";
      else if (input.contentType === "image/jpeg") ext = ".jpg";
      else ext = ".bin"; // terakhir, biarkan worker re-encode
    }

    const keyOriginal = `${ORIGINAL_PREFIX}/${
      input.albumId
    }/original/${randomUUID()}${ext}`;

    const raw = await presignPut(keyOriginal, {
      contentType: input.contentType,
      // Untuk object "original", biasanya tanpa cache publik.
      // Biarkan kosong (default S3) atau pakai private yang aman:
      // cacheControl: "private, max-age=31536000, immutable",
      contentDisposition: "inline",
    });

    console.log("[PRESIGN RAW]", raw); // <-- harus ada X-Amz-Algorithm

    const url =
      process.env.S3_TEST_REWRITE === "true" ? rewritePresignForTest(raw) : raw;

    console.log("[PRESIGN AFTER REWRITE]", url);

    // DEBUG: pastikan segmen bucket pada URL = ENV.S3_BUCKET
    // {
    //   const u = new URL(url);
    //   const bucketFromUrl = decodeURIComponent(u.pathname.split("/")[1] || "");
    //   if (bucketFromUrl !== ENV.S3_BUCKET) {
    //     console.error("Bucket mismatch:", {
    //       bucketFromUrl,
    //       envBucket: ENV.S3_BUCKET,
    //       url,
    //     });
    //     throw new Error(
    //       `Bucket mismatch: presign URL uses "${bucketFromUrl}" but ENV.S3_BUCKET="${ENV.S3_BUCKET}"`
    //     );
    //   }
    // }

    // if (!url.includes("X-Amz-Algorithm")) {
    //   console.error("[PRESIGN RAW]", raw);
    //   console.error("[PRESIGN AFTER REWRITE]", url);
    //   throw new Error("Presigned URL invalid (SigV4 params missing)");
    // }

    const isSigV4 = url.includes("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    const isGateway = /[?&]sig=/.test(url);
    if (!isSigV4 && !isGateway) {
      console.error("[PRESIGN RAW]", raw);
      console.error("[PRESIGN AFTER REWRITE]", url);
      throw new Error("Presigned URL invalid (no recognizable signature)");
    }

    return { keyOriginal, uploadUrl: url };
  },

  async confirm(input: z.infer<typeof ConfirmDto>) {
    const album = await AlbumRepo.findById(input.albumId);
    if (!album) throw NotFound("Album tidak ditemukan");

    // Hard policy: path harus sesuai album
    if (
      !new RegExp(`^${ORIGINAL_PREFIX}/${input.albumId}/original/`).test(
        input.keyOriginal
      )
    ) {
      throw new Error("invalid_original_key");
    }

    // Idempoten: cek apakah sudah ada photo dengan key yang sama di album ini
    const existing = await PhotoRepo.findByAlbumAndKey(
      input.albumId,
      input.keyOriginal
    );
    if (existing) {
      // pastikan tetap enqueue (jaga case ketika job sebelumnya fail)
      await imageQueue.add(
        "thumbnail",
        {
          photoId: existing.id,
          albumId: input.albumId,
          keyOriginal: input.keyOriginal,
        },
        {
          jobId: `photo:${existing.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        }
      );
      return existing;
    }

    try {
      // catat metadata minimal; keyThumb akan diisi worker nanti
      const photo = await PhotoRepo.create({
        albumId: input.albumId,
        keyOriginal: input.keyOriginal,
        keyThumb: null,
        mimeType: input.mimeType ?? null,
        checksum: input.checksum ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        sizeBytes: input.sizeBytes ?? null,
        caption: input.caption ?? null,
      });
      console.log("Photo create:", photo);
      console.log("Input:", input);

      // TODO: publish job ke Redis untuk generate thumbnail (worker Go)
      // // queue.add("thumbnail", { photoId: photo.id, keyOriginal: input.keyOriginal });
      await imageQueue.add(
        "thumbnail",
        {
          photoId: photo.id,
          albumId: input.albumId,
          keyOriginal: input.keyOriginal,
        },
        {
          jobId: `photo-${photo.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        }
      );
      return photo;
    } catch (e: any) {
      console.error("confirm() error:", e);
      throw e; // biar error handler kamu tangkap
    }
  },

  async list(albumId: string) {
    return PhotoRepo.listByAlbum(albumId);
  },

  async update(id: string, input: z.infer<typeof UpdatePhotoDto>) {
    const exists = await PhotoRepo.byId(id);
    if (!exists) throw NotFound("Foto tidak ditemukan");
    return PhotoRepo.update(id, input);
  },

  async remove(id: string) {
    const photo = await PhotoRepo.byId(id);
    if (!photo) throw NotFound("Foto tidak ditemukan");

    const keys = [photo.keyOriginal, photo.keyThumb].filter(
      Boolean
    ) as string[];
    await deleteObjectsBulk(keys); // best-effort

    await PhotoRepo.remove(id);
  },
};
