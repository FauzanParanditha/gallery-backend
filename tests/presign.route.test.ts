// tests/presign.route.test.ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// 1) Mock AUTH & RATE LIMIT di path yang DIPAKAI router
vi.mock("@/middlewares/authGuard", () => ({
  authGuard: (_req: any, _res: any, next: any) => next(), // bypass auth
}));
vi.mock("@/middlewares/rateLimiter", () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(), // bypass limiter
  limitPresign: (_req: any, _res: any, next: any) => next(), // bypass limiter
  limitPublicDownload: (_req: any, _res: any, next: any) => next(), // bypass limiter
  limitShareDownload: (_req: any, _res: any, next: any) => next(), // bypass limiter
  limitShareOpen: (_req: any, _res: any, next: any) => next(), // bypass limiter
}));

// 2) Mock repo album (findById) → akan kita kontrol di test
vi.mock("@/modules/albums/album.repo", async () => {
  const actual = await vi.importActual<any>("@/modules/albums/album.repo");
  return {
    ...actual,
    AlbumRepo: {
      ...actual.AlbumRepo,
      findById: vi.fn(),
    },
  };
});

// 3) Baru import SETELAH mock terpasang
import { AlbumRepo } from "@/modules/albums/album.repo";
import { app } from "./helpers"; // pastikan helpers eksport express app siap pakai

const findByIdMock = AlbumRepo.findById as unknown as Mock;

beforeEach(() => {
  // jangan restoreAllMocks (bisa balikin mock ke original); cukup clear call history
  vi.clearAllMocks();
});

describe("POST /v1/photos/presign", () => {
  it("201 OK — returns keyOriginal + signed uploadUrl", async () => {
    const ALB_ID = "clm0u2w7p0000abcde123456";
    findByIdMock.mockResolvedValue({ id: ALB_ID } as any);

    const res = await request(app).post("/v1/photos/presign").send({
      albumId: ALB_ID,
      fileName: "a.jpg",
      contentType: "image/jpeg",
      sizeBytes: 123_456,
    });
    console.log("201 OK", res.body);

    expect(res.status).toBe(201);
    const payload = res.body.data ?? res.body;

    expect(payload).toHaveProperty("keyOriginal");
    expect(payload).toHaveProperty("uploadUrl");

    // key & url checks
    expect(payload.keyOriginal).toMatch(
      new RegExp(`^albums/${ALB_ID}/original/`)
    );
    expect(payload.uploadUrl).toMatch(/^https:\/\/obj\.test\/upload\//);
    expect(payload.uploadUrl).toContain(
      encodeURIComponent(payload.keyOriginal)
    );
    expect(payload.uploadUrl).toMatch(/[?&]sig=/);
  });

  it("404 Not Found — when album does not exist", async () => {
    findByIdMock.mockResolvedValue(null);

    const res = await request(app).post("/v1/photos/presign").send({
      albumId: "clm0u2w7p0000noalbum00000",
      fileName: "a.jpg",
      contentType: "image/jpeg",
      sizeBytes: 42_000,
    });
    console.log("404 Not Found", res.body);

    expect(res.status).toBe(404);

    expect(JSON.stringify(res.body)).toMatch(/Album tidak ditemukan/i);
  });

  it("400 Bad Request — invalid payload (missing albumId)", async () => {
    const res = await request(app)
      .post("/v1/photos/presign")
      .send({ fileName: "a.jpg", contentType: "image/jpeg" }) // albumId hilang
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/albumId/i);
  });
});
