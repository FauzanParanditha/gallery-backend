import { Queue } from "bullmq";

export const connection = {
  connection: { url: process.env.REDIS_URL! },
} as const;

export const IMAGE_QUEUE_NAME = "image";

export type ThumbnailJob = {
  photoId: string;
  albumId: string;
  keyOriginal: string;
};

export const imageQueue = new Queue<ThumbnailJob>(IMAGE_QUEUE_NAME, connection);
