import { presignPut } from "@/libs/s3";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const hasGatewaySig = (url: string) => /[?&]sig=/.test(url);

describe("presignPut() — with mocked S3", () => {
  it("returns signed upload URL (gateway style) with encoded key", async () => {
    const key = `albums/test/original/${randomUUID()}.jpg`;
    const url = await presignPut(key, { contentType: "image/jpeg" });

    expect(typeof url).toBe("string");
    console.log(url);
    expect(url.startsWith("https://obj.test/upload/")).toBe(true);
    expect(url).toContain(encodeURIComponent(key));
    expect(hasGatewaySig(url)).toBe(true);
  });

  it("works with different content types", async () => {
    const key = `albums/test/original/${randomUUID()}.png`;
    const url = await presignPut(key, { contentType: "image/png" });

    expect(url.startsWith("https://obj.test/upload/")).toBe(true);
    expect(url).toContain(encodeURIComponent(key));
    expect(hasGatewaySig(url)).toBe(true);
  });
});
