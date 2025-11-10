import "dotenv/config";

import { ENV } from "@/config/env";
import { logger } from "@/libs/logger";
import { prisma } from "@/libs/prisma";
import { createApp } from "./app";

const app = createApp();
const server = app.listen(ENV.PORT, () => logger.info(`API :${ENV.PORT}`));

const shutdown = async () => {
  logger.info("Shutting down...");
  server.close(async () => {
    try {
      await prisma.$disconnect();
      // tutup redis client jika kamu punya instance global
    } finally {
      process.exit(0);
    }
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
