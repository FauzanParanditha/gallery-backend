export function rewritePresignForTest(rawUrl: string) {
  if (process.env.NODE_ENV !== "test") return rawUrl;

  const t = new URL(process.env.S3_TEST_ORIGIN || "http://127.0.0.1:9000");
  const u = new URL(rawUrl);

  // 1) ganti origin
  u.protocol = t.protocol;
  u.hostname = t.hostname;
  u.port = t.port;

  // 2) ubah prefix '/upload' -> '/<S3_BUCKET>'
  const stripPrefix = "/upload";
  const bucket = process.env.S3_BUCKET!;
  const parts = u.pathname.split("/"); // ["", "upload", "albums%2F...jpg"]
  if (parts.length >= 2 && parts[1] === stripPrefix.slice(1)) {
    parts[1] = bucket; // ganti 'upload' menjadi 'gallery-local'
    u.pathname = parts.join("/");
  }

  return u.toString();
}
