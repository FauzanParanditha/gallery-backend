// workers/image.processor.ts
import { ENV } from "@/config/env";
import { prisma } from "@/libs/prisma";
import { getObjectBufferWithRetry, putObjectBufferWithRetry } from "@/libs/s3";
import path from "node:path";
import sharp from "sharp";

export type ProcessJobData = {
  photoId: string;
  albumId: string;
  keyOriginal: string;
};

// ---- helpers aman untuk update prisma ----
async function safeUpdate(
  photoId: string,
  data: Parameters<typeof prisma.photo.update>[0]["data"]
) {
  try {
    await prisma.photo.update({ where: { id: photoId }, data });
  } catch {
    // best-effort: swallow
  }
}

export async function processThumbnail(data: ProcessJobData) {
  const { photoId, keyOriginal, albumId } = data;

  // (opsional) Lebih semantis kalau "processing", tapi mengikuti kode awal "processed"
  // await safeUpdate(photoId, { status: "processed" });

  // Idempoten cepat
  const current = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      albumId: true,
      keyThumb: true,
      status: true,
      width: true,
      height: true,
      mimeType: true,
      keyOriginal: true,
    },
  });

  if (!current) return { skipped: true, reason: "not_found" };

  // Validasi job terhadap DB terkini
  if (current.albumId !== albumId) {
    await safeUpdate(photoId, { status: "error", lastError: "album_mismatch" });
    throw new Error("album_mismatch");
  }
  if (current.keyOriginal !== keyOriginal) {
    // job lama; skip tanpa error agar tidak merusak pipeline
    return { skipped: true, reason: "stale_job_key" };
  }

  // Idempoten cepat
  if (current.status === "processed" && current.keyThumb) {
    return {
      skipped: true,
      reason: "already_processed",
      keyThumb: current.keyThumb,
    };
  }

  if (current.keyThumb) {
    return {
      skipped: true,
      reason: "already_has_thumb",
      keyThumb: current.keyThumb,
    };
  }

  // Validasi namespace path
  if (!/^albums\/[^/]+\/original\//.test(keyOriginal)) {
    await safeUpdate(photoId, {
      status: "error",
      lastError: "invalid_original_key",
    });
    throw new Error("invalid_original_key");
  }

  // Ambil objek
  let original: Buffer;
  try {
    original = await getObjectBufferWithRetry(keyOriginal, 3);
    if (!original?.length) throw new Error("empty_object");
  } catch (e: any) {
    // simpan error tapi JANGAN memakan errornya — biar test bisa assert /NoSuchKey/i
    await safeUpdate(photoId, {
      status: "error",
      lastError: String(e).slice(0, 1000),
    });
    throw e;
  }

  // Metadata + salvage
  let working = original;
  let metaOrig = await sharp(working, { failOn: "none" })
    .metadata()
    .catch(async () => {
      // salvage ke jpeg kalau metadata gagal
      working = await sharp(working).toFormat("jpeg").toBuffer();
      return sharp(working).metadata();
    });

  const isAnimated = (metaOrig?.pages ?? 1) > 1;
  if (isAnimated) {
    const msg = `animated_${metaOrig?.format ?? "image"}_not_supported`;
    await safeUpdate(photoId, { status: "error", lastError: msg });
    throw new Error(msg);
  }

  // Resize + normalisasi orientasi
  const pipeline = sharp(working, { failOn: "none" })
    .rotate()
    .withMetadata({ orientation: undefined })
    .resize({
      width: 960,
      height: 960,
      fit: "inside",
      withoutEnlargement: true,
    });

  // Output: homogen WebP (lossy)
  const outMime = "image/webp";
  const outBuf = await pipeline.webp({ quality: 82 }).toBuffer();
  const metaThumb = await sharp(outBuf).metadata();

  // Bangun key thumb: /original/ → /thumb/
  const parsed = path.posix.parse(keyOriginal);
  const dirThumb = parsed.dir.replace(/\/original(\/|$)/, "/thumb$1");
  const keyThumb = path.posix.join(dirThumb, `${parsed.name}.webp`);

  // Upload thumbnail
  try {
    await putObjectBufferWithRetry(
      keyThumb,
      outBuf,
      outMime,
      {
        CacheControl: "public, max-age=31536000, immutable",
        ContentDisposition: "inline",
      },
      3
    );
  } catch (e: any) {
    await safeUpdate(photoId, {
      status: "error",
      lastError: `putObject: ${String(e).slice(0, 950)}`,
    });
    throw e;
  }

  // Update DB final
  await prisma.photo.update({
    where: { id: photoId },
    data: {
      keyThumb,
      width: metaThumb.width ?? current.width ?? metaOrig?.width ?? null,
      height: metaThumb.height ?? current.height ?? metaOrig?.height ?? null,
      // mimeType: current.mimeType ?? outMime,
      status: "processed",
      lastError: null,
    },
  });

  return {
    keyThumb,
    width: metaThumb.width ?? null,
    height: metaThumb.height ?? null,
    bucket: ENV.S3_BUCKET,
  };
}
