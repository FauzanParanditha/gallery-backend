import { isProd } from "@/config/env";
import pino from "pino";

export const logger = isProd
  ? pino({ level: "info" })
  : pino({
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l 'GMT' o",
          singleLine: true,
        },
      },
    });
