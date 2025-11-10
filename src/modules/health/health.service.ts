import { prisma } from "@/libs/prisma";
import { queuePing } from "@/modules/health/queue.ping";
import { s3HeadBucket } from "@/modules/health/s3.headbucket";

export const HealthService = {
  async status() {
    const startedAt = process.uptime(); // detik
    // DB check (fast)
    await prisma.$queryRaw`SELECT 1`;

    // Queue/Redis check
    const queue = await queuePing();

    return {
      uptimeSec: Math.floor(startedAt),
      db: "ok",
      queue, // { ok: true, pingMs: ... }
    };
  },

  async storage() {
    const info = await s3HeadBucket(); // { ok, bucket, region }
    return info;
  },
};
