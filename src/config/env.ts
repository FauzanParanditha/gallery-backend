import { z } from "@/libs/z";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(8080),

  // Database & Queue
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().url(),

  // S3 / MinIO
  S3_ENDPOINT: z.string(),
  S3_BUCKET: z.string(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().optional(),
  REFRESH_EXPIRES_IN: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),

  // Worker tuning
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),

  // Cors
  CORS_ORIGIN: z.string(),

  // Testing helpers
  S3_TEST_REWRITE: z.enum(["true", "false"]).default("false"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // tampilkan daftar kunci yang hilang
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error("ENV missing/invalid:", missing);
  process.exit(1);
}
export const ENV = parsed.data;
export const isProd = ENV.NODE_ENV === "production";
