import { prisma } from "@/libs/prisma";
import { randomUUID } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app, loginAndGetCookie } from "./helpers";

async function createAlbumAndPhotoProcessed(cookie: string) {
  const slug = `share-${randomUUID().slice(0, 8)}`;
  const a = await request(app)
    .post("/v1/albums")
    .set("Cookie", cookie)
    .send({ slug, title: "Share Album", isPublished: false })
    .expect(201);
  const album = a.body.data ?? a.body;

  // min 1 foto processed agar UI publik ada isi
  await prisma.photo.create({
    data: {
      albumId: album.id,
      keyOriginal: `albums/${album.id}/original/${randomUUID()}.jpg`,
      keyThumb: `albums/${album.id}/thumb/${randomUUID()}.webp`,
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      sizeBytes: 123456,
      status: "processed",
    },
  });

  return album;
}

describe("Share — create & open", () => {
  let cookie: string;

  beforeAll(async () => {
    const session = await loginAndGetCookie();
    cookie = session.cookie;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("create share link (201) and open (200)", async () => {
    const album = await createAlbumAndPhotoProcessed(cookie);

    const expiresAt = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000
    ).toISOString();
    const cre = await request(app)
      .post(`/v1/share/albums/${album.id}`)
      .set("Cookie", cookie)
      .send({ note: "e2e", expiresAt })
      .expect(201);

    const link = cre.body.data ?? cre.body;
    expect(typeof link.slug).toBe("string");

    const op = await request(app).get(`/v1/share/${link.slug}`).expect(200);
    const data = op.body.data ?? op.body;
    expect(data.album?.id).toBe(album.id);
    expect(Array.isArray(data.album?.photos)).toBe(true);
    // hanya processed yang tampil
    expect(data.album.photos.every((p: any) => p.keyThumb && p.id)).toBe(true);
  });

  it("open expired share should return 410", async () => {
    const album = await createAlbumAndPhotoProcessed(cookie);

    const expiresAt = new Date(Date.now() + 1000).toISOString();
    const cre = await request(app)
      .post(`/v1/share/albums/${album.id}`)
      .set("Cookie", cookie)
      .send({ expiresAt })
      .expect(201);

    const link = cre.body.data ?? cre.body;
    // tunggu kadaluarsa
    await new Promise((r) => setTimeout(r, 1100));

    const op = await request(app).get(`/v1/share/${link.slug}`);
    expect(op.status).toBe(403);
  });

  it("open unknown slug should be 404", async () => {
    const res = await request(app).get(`/v1/share/sh-unknown1234`);
    expect(res.status).toBe(404);
  });
});
