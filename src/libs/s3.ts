import { ENV } from "@/config/env";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "./logger";

// ---------- Config & Client ----------
const baseConfig = {
  region: ENV.S3_REGION,
  endpoint: ENV.S3_ENDPOINT,
  // MinIO umumnya butuh path style; jika full AWS S3 murni, boleh dijadikan false.
  forcePathStyle: true,
  credentials: {
    accessKeyId: ENV.S3_ACCESS_KEY_ID,
    secretAccessKey: ENV.S3_SECRET_ACCESS_KEY,
  },
};

// Client khusus TEST yang langsung ke origin MinIO (melewati gateway / proxy)
const testConfig = {
  region: "us-east-1",
  endpoint: process.env.S3_TEST_ORIGIN || "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: ENV.S3_ACCESS_KEY_ID,
    secretAccessKey: ENV.S3_SECRET_ACCESS_KEY,
  },
};

export const s3 = new S3Client(
  process.env.NODE_ENV === "test" ? testConfig : baseConfig
);

/* =========================
 * (1) Endpoint logging yang aman (EndpointV2-safe)
 * ========================= */
async function logResolvedEndpoint(client: S3Client) {
  try {
    const ep: any = await (client as any).config.endpoint();
    const protocolRaw: string = ep?.protocol ?? "https:";
    const protocol = protocolRaw.replace(/:$/, "");
    const hostname: string =
      ep?.hostname ?? ep?.host ?? ep?.url?.hostname ?? "unknown-host";
    const port = ep?.port ? `:${ep.port}` : "";
    const path = ep?.path ?? ep?.url?.pathname ?? "";
    // Gunakan console agar tetap tampil meski logger di-set filtering
    console.log(
      "[S3 DEBUG] endpoint =",
      `${protocol}://${hostname}${port}${path}`
    );
    console.log(
      "[S3 DEBUG] forcePathStyle =",
      (client as any).config.forcePathStyle
    );
  } catch (e) {
    console.log("[S3 DEBUG] endpoint resolver error:", e);
  }
}

// Panggil logging endpoint hanya di non-production
if (process.env.NODE_ENV !== "production") {
  // Tidak blocking init; cukup fire-and-forget
  void logResolvedEndpoint(s3);
}

/* =========================
 * (2) Middleware untuk melog URL request final
 *   - Terpasang di step "finalizeRequest" supaya URL sudah final (post-serialize)
 * ========================= */
s3.middlewareStack.add(
  (next: any, ctx: any) => async (args: any) => {
    const res = await next(args);
    try {
      const req: any = args?.request; // NodeHttpHandler request
      if (req?.protocol && req?.hostname) {
        const port = req.port ? `:${req.port}` : "";
        const path = req.path || req.pathname || "";
        const cmd = ctx?.commandName || "UnknownCommand";
        console.log(
          "[S3 DEBUG] request URL:",
          `${req.protocol}//${req.hostname}${port}${path}`,
          "| cmd:",
          cmd
        );
      }
    } catch {
      // noop
    }
    return res;
  },
  { step: "finalizeRequest" }
);

/* =========================
 * (3) Helper untuk memeriksa hasil presign
 * ========================= */
function inspectSignedUrl(url: string, label: string) {
  try {
    const u = new URL(url);
    console.log(`[PRESIGN INSPECT] (${label}) host :`, u.host);
    console.log(`[PRESIGN INSPECT] (${label}) path :`, u.pathname);
    console.log(`[PRESIGN INSPECT] (${label}) query:`, u.search);
  } catch (e) {
    console.log(`[PRESIGN INSPECT] (${label}) failed to parse:`, e);
  }
}

// ---------- Helpers ----------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function shouldRetry(err: unknown): boolean {
  const msg = String(err);
  // No retry untuk 404/NoSuchKey
  if (/NoSuchKey|NotFound|404/.test(msg)) return false;
  // Retry untuk error jaringan/5xx/timeout
  if (/ECONNRESET|ETIMEDOUT|EHOSTUNREACH|SSL|Timed?out/i.test(msg)) return true;
  if (/\b5\d{2}\b/.test(msg)) return true;
  return true; // default: coba retry, ada batas maxTries
}

async function backoff(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks);
}

// ---------- Presign ----------
type PresignPutOpts = {
  contentType: string;
  expiresSec?: number; // default 300, dibatasi 60..3600
  cacheControl?: string;
  contentDisposition?: string;
};

export async function presignPut(key: string, opts: PresignPutOpts) {
  const expires = clamp(opts.expiresSec ?? 300, 60, 3600);

  const cmd = new PutObjectCommand({
    Bucket: ENV.S3_BUCKET,
    Key: key,
    ContentType: opts.contentType,
    // Header default bisa diset saat upload langsung; presign mewarisi parameter ini
    CacheControl: opts.cacheControl,
    ContentDisposition: opts.contentDisposition,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: expires });
  if (!url.includes("X-Amz-Algorithm")) {
    throw new Error(`[presignPut] Invalid URL (missing SigV4): ${url}`);
  }
  return url;
}

export async function presignGet(key: string, expiresSec = 300) {
  const expires = clamp(expiresSec, 60, 3600);
  const cmd = new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key });
  const url = await getSignedUrl(s3, cmd, { expiresIn: expires });
  if (!url.includes("X-Amz-Algorithm")) {
    throw new Error(`[presignGet] Invalid URL (missing SigV4): ${url}`);
  }
  return url;
}

// ---------- Low-level (tanpa retry) ----------
export async function getObjectBuffer(
  key: string,
  timeoutMs = 15000
): Promise<Buffer> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key }),
      { abortSignal: ac.signal }
    );
    if (!res.Body) throw new Error("Empty Body");
    return await streamToBuffer(res.Body as any);
  } finally {
    clearTimeout(t);
  }
}

export async function putObjectBuffer(
  key: string,
  buf: Buffer,
  contentType: string,
  extra?: { CacheControl?: string; ContentDisposition?: string },
  timeoutMs = 15000
) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: ENV.S3_BUCKET,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: extra?.CacheControl,
        ContentDisposition: extra?.ContentDisposition,
      }),
      { abortSignal: ac.signal }
    );
  } finally {
    clearTimeout(t);
  }
}

// ---------- Versi dengan retry ----------
export async function getObjectBufferWithRetry(
  key: string,
  maxTries = 3,
  timeoutMs = 15000
): Promise<Buffer> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxTries) {
    try {
      return await getObjectBuffer(key, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (!shouldRetry(e) || attempt === maxTries - 1) throw e;
      await backoff(250 * (attempt + 1));
      attempt++;
    }
  }
  // seharusnya unreachable
  throw lastErr;
}

export async function putObjectBufferWithRetry(
  key: string,
  buf: Buffer,
  contentType: string,
  extra?: { CacheControl?: string; ContentDisposition?: string },
  maxTries = 3,
  timeoutMs = 15000
): Promise<void> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxTries) {
    try {
      await putObjectBuffer(key, buf, contentType, extra, timeoutMs);
      return;
    } catch (e) {
      lastErr = e;
      if (!shouldRetry(e) || attempt === maxTries - 1) throw e;
      await backoff(250 * (attempt + 1));
      attempt++;
    }
  }
  if (lastErr) throw lastErr;
}

export async function deleteObject(key: string): Promise<boolean> {
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: ENV.S3_BUCKET,
        Key: key,
      })
    );
    logger.info({ key }, "[S3] deleteObject OK");
    return true;
  } catch (err: any) {
    // AWS error code: NoSuchKey = OK
    const code = err?.name || err?.Code || "";
    if (code === "NoSuchKey") {
      logger.warn({ key }, "[S3] deleteObject: NoSuchKey (ignore)");
      return false;
    }
    logger.error({ key, err: String(err) }, "[S3] deleteObject failed");
    return false;
  }
}

/**
 * Menghapus beberapa object sekaligus (best-effort, tidak throw).
 * Return: jumlah yang berhasil dihapus.
 */
export async function deleteObjectsBulk(keys: string[]): Promise<number> {
  const results = await Promise.allSettled(keys.map((k) => deleteObject(k)));
  const ok = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = results.length - ok;
  if (failed > 0) {
    logger.warn({ ok, failed }, "[S3] deleteObjectsBulk partial");
  }
  return ok;
}

/**
 * Hapus seluruh object di bawah prefix tertentu (recursive).
 * - Melakukan paginasi dengan ListObjectsV2.
 * - Menghapus per batch hingga 1000 objek (batas API).
 * - Best-effort: lanjut walau sebagian gagal.
 * Return: { deleted, failed }
 */
// export async function deletePrefix(
//   prefix: string
// ): Promise<{ deleted: number; failed: number }> {
//   let continuationToken: string | undefined = undefined;
//   let totalDeleted = 0;
//   let totalFailed = 0;

//   // Normalisasi prefix: hilangkan leading slash
//   const normPrefix = prefix.replace(/^\/+/, "");

//   do {
//     const list = await s3.send(
//       new ListObjectsV2Command({
//         Bucket: ENV.S3_BUCKET,
//         Prefix: normPrefix,
//         ContinuationToken: continuationToken,
//         MaxKeys: 1000,
//       })
//     );

//     const contents = (list.Contents || []).filter(Boolean) as S3Object[];
//     if (contents.length === 0) {
//       continuationToken = list.IsTruncated
//         ? list.NextContinuationToken
//         : undefined;
//       continue;
//     }

//     // Batch delete (maks 1000 per request)
//     const chunks: S3Object[][] = [];
//     for (let i = 0; i < contents.length; i += 1000) {
//       chunks.push(contents.slice(i, i + 1000));
//     }

//     for (const chunk of chunks) {
//       const objects = chunk
//         .map((obj) => obj.Key)
//         .filter((k): k is string => Boolean(k))
//         .map((Key) => ({ Key }));

//       if (objects.length === 0) continue;

//       try {
//         const delRes = await s3.send(
//           new DeleteObjectsCommand({
//             Bucket: ENV.S3_BUCKET,
//             Delete: { Objects: objects, Quiet: true },
//           })
//         );
//         const deletedCount = delRes.Deleted?.length ?? 0;
//         const errorCount = delRes.Errors?.length ?? 0;
//         totalDeleted += deletedCount;
//         totalFailed += errorCount;

//         if (errorCount > 0) {
//           logger.warn(
//             { prefix: normPrefix, deleted: deletedCount, failed: errorCount },
//             "[S3] deletePrefix partial errors"
//           );
//         }
//       } catch (err) {
//         // Jika request delete batch gagal total, coba jatuhkan ke delete per key (best-effort)
//         logger.error(
//           { err: String(err) },
//           "[S3] deletePrefix batch failed, fallback per-key"
//         );
//         const results = await Promise.allSettled(
//           objects.map((o) =>
//             s3.send(
//               new DeleteObjectCommand({ Bucket: ENV.S3_BUCKET, Key: o.Key })
//             )
//           )
//         );
//         results.forEach((r) => {
//           if (r.status === "fulfilled") totalDeleted += 1;
//           else totalFailed += 1;
//         });
//       }
//     }

//     continuationToken = list.IsTruncated
//       ? list.NextContinuationToken
//       : undefined;
//   } while (continuationToken);

//   logger.info(
//     { prefix: normPrefix, deleted: totalDeleted, failed: totalFailed },
//     "[S3] deletePrefix done"
//   );
//   return { deleted: totalDeleted, failed: totalFailed };
// }
