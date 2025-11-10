import { logger } from "@/libs/logger";
import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });
client.on("error", (e) => logger.error({ err: e }, "Redis metrics error"));
client.connect(); // fire-and-forget; aman untuk start

function ttlUntilMidnightSeconds() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0); // midnight berikutnya
  return Math.max(1, Math.floor((end.getTime() - now.getTime()) / 1000));
}

/**
 * Key: metrics:presign:YYYYMMDD:u:<userId|ip>:a:<albumId>
 * Value: counter (incr)
 */
export async function bumpPresignCounter(userOrIp: string, albumId: string) {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(d.getDate()).padStart(2, "0")}`;
  const key = `metrics:presign:${day}:u:${userOrIp}:a:${albumId}`;
  const ttl = ttlUntilMidnightSeconds();

  // INCR + set TTL jika baru
  const val = await client.incr(key);
  if (val === 1) {
    await client.expire(key, ttl);
  }
  logger.info({ msg: "presign.bump", key, val });
  return { key, val };
}

/** Ambil total presign per user (semua album) hari ini */
export async function getUserDailyPresign(userOrIp: string) {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(d.getDate()).padStart(2, "0")}`;
  const pattern = `metrics:presign:${day}:u:${userOrIp}:a:*`;
  // gunakan SCAN  (hindari KEYS di prod)
  const keys: string[] = [];
  let cursor = 0;
  do {
    const resp = await client.scan(String(cursor), {
      MATCH: pattern,
      COUNT: 100,
    });
    cursor = Number(resp.cursor);
    keys.push(...resp.keys);
  } while (cursor !== 0);

  if (!keys.length)
    return { total: 0, byAlbum: [] as { albumId: string; count: number }[] };

  const vals = await client.mGet(keys);
  const byAlbum = keys.map((k, i) => {
    const albumId = k.split(":").pop()!.replace("a:", "");
    return { albumId, count: parseInt(vals[i] || "0", 10) };
  });

  const total = byAlbum.reduce((s, x) => s + x.count, 0);
  return { total, byAlbum };
}
