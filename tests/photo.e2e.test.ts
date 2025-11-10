import { randomUUID } from "crypto";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// --- sesuaikan import berikut sesuai proyekmu ---
import { prisma } from "@/libs/prisma";
import { getObjectBufferWithRetry } from "@/libs/s3";
import worker from "workers/image.worker";
import { app, loginAndGetCookie } from "./helpers";

// Helper kecil: tunggu kondisi sampai timeout
async function waitFor<T>(
  fn: () => Promise<T>,
  checker: (v: T) => boolean,
  { timeoutMs = 20000, intervalMs = 500 } = {}
): Promise<T> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const v = await fn();
    if (checker(v)) return v;
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timeout");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function loginAsAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "Admin123!";
  const res = await request(app)
    .post("/v1/auth/login")
    .send({ email, password })
    .expect(200);
  // sesuaikan field token sesuai respon login kamu
  const { accessToken } = res.body.data || res.body.user;
  expect(accessToken).toBeTypeOf("string");
  return accessToken as string;
}

async function createAlbum(cookie: string) {
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  const res = await request(app)
    .post("/v1/albums")
    .set("Cookie", cookie)
    .send({
      slug,
      title: "E2E Test Album",
      description: "album untuk e2e photo",
      isPublished: false,
    })
    .expect(201);
  const album = res.body.data || res.body;
  expect(album?.id).toBeTypeOf("string");
  return album;
}

async function generateImageBuffer({
  width = 1200,
  height = 800,
}: { width?: number; height?: number } = {}) {
  // gambar polos 1200x800
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 200, b: 220 },
    },
  })
    .jpeg({ quality: 88 })
    .toBuffer();
  return { buf, width, height, mime: "image/jpeg" as const };
}

describe("E2E: Photos — presign → upload → confirm → worker → thumb OK", () => {
  let cookie: string;
  let album: any;

  beforeAll(async () => {
    // pastikan env test rewrite presign aktif untuk gateway-style
    process.env.S3_TEST_REWRITE = "false";
    const session = await loginAndGetCookie(); // { cookie, user }
    cookie = session.cookie;
    album = await createAlbum(cookie);
  });

  afterAll(async () => {
    // Tutup worker & prisma
    try {
      await worker.close();
    } catch {}
    await prisma.$disconnect();
  });

  it("should complete full flow", async () => {
    // 1) PRESIGN
    const { buf, width, height, mime } = await generateImageBuffer();
    const fileName = "e2e-photo.jpg";
    const presignRes = await request(app)
      .post("/v1/photos/presign")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        contentType: mime,
        fileName,
        sizeBytes: 123_456,
      })
      .expect(201);
    const { keyOriginal, uploadUrl } = presignRes.body.data || presignRes.body;
    expect(typeof keyOriginal).toBe("string");
    expect(typeof uploadUrl).toBe("string");
    expect(uploadUrl).toMatch(/X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    expect(keyOriginal.startsWith(`albums/${album.id}/original/`)).toBe(true);

    // 2) UPLOAD ke URL yang dipresign
    //    gunakan undici/fetch native Node 18+ (Vitest)
    const body = new Uint8Array(buf);
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: body,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": "inline",
      },
    });
    expect(putRes.ok).toBe(true);

    // 3) CONFIRM (tulis row Photo + enqueue job)
    const confirmRes = await request(app)
      .post("/v1/photos/confirm")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        keyOriginal,
        mimeType: mime,
        width,
        height,
        sizeBytes: buf.length,
        caption: "Foto E2E",
      })
      .expect(201);

    const photo = confirmRes.body.data || confirmRes.body;
    expect(photo?.id).toBeTypeOf("string");
    expect(photo?.status).toBeDefined(); // biasanya "pending"

    // 4) TUNGGU WORKER memproses menjadi processed + keyThumb terisi
    //    polling via prisma langsung (lebih deterministik)
    const processed = await waitFor(
      async () =>
        prisma.photo.findUnique({
          where: { id: photo.id },
          select: { status: true, keyThumb: true, keyOriginal: true },
        }),
      // checker:
      (p) => Boolean(p && p.status === "processed" && p.keyThumb)
    );

    expect(processed?.status).toBe("processed");
    expect(typeof processed?.keyThumb).toBe("string");

    // 5) Validasi thumb benar-benar ada di storage (getObject)
    const thumbBuf = await getObjectBufferWithRetry(processed!.keyThumb!, 2);
    expect(thumbBuf.length).toBeGreaterThan(0);

    // 6) List by album (API) berisi foto kita
    const listRes = await request(app)
      .get(`/v1/photos/album/${album.id}`)
      .set("Cookie", cookie)
      .expect(200);

    const items = listRes.body.data || listRes.body;
    const found = items.find((it: any) => it.id === photo.id);
    expect(found).toBeTruthy();
    expect(found.keyThumb).toBeDefined();
  }, 30000);
});
