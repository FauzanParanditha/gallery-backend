import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());

describe.skip("presignPut() — integration (real libs/s3)", () => {
  it("returns real signed URL (SigV4 atau gateway)", async () => {
    vi.doUnmock("@/libs/s3");
    process.env.NODE_ENV = "test";
    process.env.S3_TEST_ORIGIN =
      process.env.S3_TEST_ORIGIN || "http://127.0.0.1:9000";
    const { presignPut } = await import("@/libs/s3");

    const key = `albums/test/original/${Date.now()}.jpg`;
    const url = await presignPut(key, { contentType: "image/jpeg" });

    const signed =
      /X-Amz-Algorithm=AWS4-HMAC-SHA256/.test(url) || /[?&]sig=/.test(url);
    expect(signed).toBe(true);
  });
});
