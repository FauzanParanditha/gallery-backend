import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "./helpers";

// Override mock rate limiter khusus test ini:
vi.mock("@/middlewares/rateLimiters", async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    limitPublicDownload: (function () {
      let calls = 0;
      return (_req: any, res: any, next: any) => {
        calls++;
        if (calls > 1)
          return res.status(429).json({ error: "TooManyRequests" });
        next();
      };
    })(),
  };
});

describe("Rate limit 429 (public download)", () => {
  it("429 pada panggilan berikutnya", async () => {
    // gunakan id foto dummy; controller akan 404, tapi kita fokus ke limiter 429
    const p1 = await request(app)
      .post("/v1/public/photos/photo_dummy/download")
      .send();
    expect([200, 403, 404, 429]).toContain(p1.status); // pertama lolos ke handler, tergantung implementasi
    const p2 = await request(app)
      .post("/v1/public/photos/photo_dummy/download")
      .send();
    expect(p2.status).toBe(429);
  });
});
