import { ENV } from "@/config/env";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Test = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_TEST_ORIGIN || "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: ENV.S3_ACCESS_KEY_ID,
    secretAccessKey: ENV.S3_SECRET_ACCESS_KEY,
  },
});

export async function presignPutTest(
  key: string,
  contentType: string,
  expiresSec = 300
) {
  const url = await getSignedUrl(
    s3Test,
    new PutObjectCommand({
      Bucket: ENV.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresSec }
  );
  return url;
}
export async function presignGetTest(key: string, expiresSec = 300) {
  const url = await getSignedUrl(
    s3Test,
    new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key }),
    { expiresIn: expiresSec }
  );
  return url;
}
