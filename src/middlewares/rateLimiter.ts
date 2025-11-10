import rateLimit from "express-rate-limit";

import type { NextFunction, Request, Response } from "express";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { createClient } from "redis";

export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }); // sesuaikan

const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (e) => console.error("Redis error", e));
redis.connect(); // fire-and-forget

function clientIp(req: Request) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  return (
    xf.split(",")[0].trim() || req.ip || req.socket.remoteAddress || "unknown"
  );
}

/* -------------------- PUBLIC DOWNLOAD (direct) -------------------- */
const memPublicDownload = new RateLimiterMemory({
  keyPrefix: "mem:public:download",
  points: 60,
  duration: 60,
});

const rlPublicDownload = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl:public:download",
  points: 60,
  duration: 60,
  insuranceLimiter: memPublicDownload,
  // optional: blockDuration: 60 * 5, // ban 5 menit
});

export async function limitPublicDownload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await rlPublicDownload.consume(clientIp(req));
    next();
  } catch {
    res.status(429).json({
      error: "TooManyRequests",
      message: "Rate limit exceeded (download)",
      requestId: (req as any).requestId,
    });
  }
}

/* -------------------- SHARE: OPEN & DOWNLOAD -------------------- */
const memShareOpen = new RateLimiterMemory({
  keyPrefix: "mem:share:open",
  points: 30,
  duration: 60,
});
const rlShareOpen = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl:share:open",
  points: 30,
  duration: 60,
  insuranceLimiter: memShareOpen,
});

export async function limitShareOpen(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = `${clientIp(req)}:${req.params.slug || "noslug"}`;
  try {
    await rlShareOpen.consume(key);
    next();
  } catch {
    res.status(429).json({
      error: "TooManyRequests",
      message: "Rate limit exceeded (open share)",
      requestId: (req as any).requestId,
    });
  }
}

const memShareDownload = new RateLimiterMemory({
  keyPrefix: "mem:share:download",
  points: 60,
  duration: 60,
});
const rlShareDownload = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl:share:download",
  points: 60,
  duration: 60,
  insuranceLimiter: memShareDownload,
});

export async function limitShareDownload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = `${clientIp(req)}:${req.params.slug || "noslug"}`;
  try {
    await rlShareDownload.consume(key);
    next();
  } catch {
    res.status(429).json({
      error: "TooManyRequests",
      message: "Rate limit exceeded (share download)",
      requestId: (req as any).requestId,
    });
  }
}

/* -------------------- PRESIGN (per-user/IP + per-album) -------------------- */
// Minute limiter
const memPresignMinute = new RateLimiterMemory({
  keyPrefix: "mem:presign:m",
  points: 30,
  duration: 60,
});
const rlPresignMinute = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl:presign:m",
  points: 30,
  duration: 60,
  insuranceLimiter: memPresignMinute,
});

// Daily limiter
const memPresignDaily = new RateLimiterMemory({
  keyPrefix: "mem:presign:d",
  points: 1000,
  duration: 60 * 60 * 24,
});
const rlPresignDaily = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl:presign:d",
  points: 1000,
  duration: 60 * 60 * 24,
  insuranceLimiter: memPresignDaily,
});

export async function limitPresign(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = (req as any).user?.id as string | undefined;
  const ip = clientIp(req);
  const albumId = (req.body?.albumId as string | undefined) || "na";
  const baseKey = userId ? `u:${userId}` : `ip:${ip}`;
  const minuteKey = `${baseKey}:a:${albumId}`;
  const dailyKey = baseKey;

  try {
    await Promise.all([
      rlPresignMinute.consume(minuteKey),
      rlPresignDaily.consume(dailyKey),
    ]);
    next();
  } catch {
    res.status(429).json({
      error: "TooManyRequests",
      message:
        "Terlalu banyak permintaan upload (presign). Coba lagi beberapa saat.",
      requestId: (req as any).requestId,
    });
  }
}
