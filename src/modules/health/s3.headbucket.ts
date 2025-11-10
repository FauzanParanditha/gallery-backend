import { ENV } from "@/config/env";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: ENV.S3_REGION,
  endpoint: ENV.S3_ENDPOINT,
  credentials: {
    accessKeyId: ENV.S3_ACCESS_KEY_ID,
    secretAccessKey: ENV.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

export async function s3HeadBucket() {
  const started = Date.now();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: ENV.S3_BUCKET }));
    return {
      ok: true as const,
      bucket: ENV.S3_BUCKET,
      region: ENV.S3_REGION,
      pingMs: Date.now() - started,
    };
  } catch (e: any) {
    return {
      ok: false as const,
      bucket: ENV.S3_BUCKET,
      region: ENV.S3_REGION,
      error: String(e?.message ?? e),
    };
  }
}
