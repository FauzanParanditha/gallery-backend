import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connections = {
  connection: { url: process.env.REDIS_URL! },
} as const;

export const redis = new IORedis(process.env.REDIS_URL!);
export const connection = redis;

export const IMAGE_QUEUE_NAME = "image";

export type ThumbnailJob = {
  photoId: string;
  albumId: string;
  keyOriginal: string;
};

export const imageQueue = new Queue<ThumbnailJob>(IMAGE_QUEUE_NAME, {
  connection,
});
