import "dotenv/config";

import { logger } from "@/libs/logger";
import { prisma } from "@/libs/prisma";
import { connection, IMAGE_QUEUE_NAME } from "@/libs/queue";
import { Worker } from "bullmq";
import sharp from "sharp";
import { ProcessJobData, processThumbnail } from "./image.processor";

type JobData = { photoId: string; albumId: string; keyOriginal: string };

// global sharp tuning (aman dipanggil sekali di proses worker)
sharp.concurrency(2);
// sharp.cache({ files: 0 }); // uncomment bila RAM ketat

const worker = new Worker(
  IMAGE_QUEUE_NAME,
  async (job) => {
    if (job.name !== "thumbnail") return;
    // const startedAt = Date.now();
    return processThumbnail(job.data as ProcessJobData);
  },
  { ...connection, concurrency: 4 }
);

// Logging
worker.on("completed", (job, res) => {
  logger.info({ id: job.id, res }, "[image.worker] completed");
});
worker.on("failed", async (job, err) => {
  const data = job?.data as JobData | undefined;
  if (data?.photoId) {
    await prisma.photo
      .update({
        where: { id: data.photoId },
        data: { status: "error", lastError: String(err).slice(0, 1000) },
      })
      .catch(() => {});
  }
  logger.error(
    { id: job?.id, err: String(err), stack: (err as any)?.stack },
    "[image.worker] failed"
  );
});
worker.on("stalled", (jobId) => {
  logger.warn({ jobId }, "[image.worker] stalled");
});

// global safety
process.on("unhandledRejection", (err) => {
  logger.error({ err }, "[image.worker] unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "[image.worker] uncaughtException");
});

// Graceful shutdown
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    logger.info(`[image.worker] ${sig} received, closing worker…`);
    try {
      await worker.close();
    } finally {
      process.exit(0);
    }
  });
}

logger.info("📸 Image worker started...");
export default worker;
