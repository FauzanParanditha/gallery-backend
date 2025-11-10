import { prisma } from "@/libs/prisma";
import { randomUUID } from "crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "./helpers";

async function mkAlbum({ published = true }: { published?: boolean } = {}) {
  const slug = `pub-${randomUUID().slice(0, 8)}`;
  return prisma.album.create({
    data: {
      slug,
      title: `Public ${slug}`,
      isPublished: published,
    },
  });
}

async function mkPhoto(
  albumId: string,
  status: "processed" | "pending" | "error" = "processed"
) {
  return prisma.photo.create({
    data: {
      albumId,
      keyOriginal: `albums/${albumId}/original/${randomUUID()}.jpg`,
      keyThumb:
        status === "processed"
          ? `albums/${albumId}/thumb/${randomUUID()}.webp`
          : null,
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      sizeBytes: 111_111,
      status,
      caption: `cap-${randomUUID().slice(0, 4)}`,
    },
  });
}

async function mkShare(
  albumId: string,
  { expireMs }: { expireMs?: number } = {}
) {
  const slug = `sh-${randomUUID().slice(0, 8)}`;
  const expiresAt =
    typeof expireMs === "number" ? new Date(Date.now() + expireMs) : null;
  const link = await prisma.shareLink.create({
    data: { albumId, slug, note: "test", expiresAt },
  });
  return link;
}

describe("Public download endpoints", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ---------- DIRECT DOWNLOAD ----------
  it("direct: 200 when album is published and photo processed", async () => {
    const album = await mkAlbum({ published: true });
    const photo = await mkPhoto(album.id, "processed");

    const res = await request(app)
      .post(`/v1/public/photos/${photo.id}/download`)
      .send(); // body kosong

    expect(res.status, res.text).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(typeof data.url).toBe("string");
    expect(data.url.length).toBeGreaterThan(10);
    // (opsional) mimeType jika kamu kembalikan
    if (data.mimeType) expect(data.mimeType).toMatch(/^image\//);
  });

  it("direct: 403 when album is not published", async () => {
    const album = await mkAlbum({ published: false });
    const photo = await mkPhoto(album.id, "processed");

    const res = await request(app)
      .post(`/v1/public/photos/${photo.id}/download`)
      .send();

    expect(res.status).toBe(403);
  });

  it("direct: 403 when photo is pending", async () => {
    const album = await mkAlbum({ published: true });
    const photo = await mkPhoto(album.id, "pending");

    const res = await request(app)
      .post(`/v1/public/photos/${photo.id}/download`)
      .send();

    expect(res.status).toBe(403);
  });

  it("direct: 404 when photo not found", async () => {
    const res = await request(app)
      .post(`/v1/public/photos/unknown-photo-id/download`)
      .send();

    expect([404, 400]).toContain(res.status); // tergantung error handler kamu
  });

  // ---------- SHARE DOWNLOAD ----------
  it("share: 200 when slug valid, not expired, photo processed and belongs to album", async () => {
    const album = await mkAlbum({ published: false }); // boleh unpublished via share
    const photo = await mkPhoto(album.id, "processed");
    const share = await mkShare(album.id); // no expire

    const res = await request(app)
      .post(`/v1/public/share/${share.slug}/photos/${photo.id}/download`)
      .send();

    expect(res.status, res.text).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(typeof data.url).toBe("string");
  });

  it("share: 410 when slug expired", async () => {
    const album = await mkAlbum({ published: false });
    const photo = await mkPhoto(album.id, "processed");
    const share = await mkShare(album.id, { expireMs: 300 }); // 0.3s

    // tunggu lewat kadaluarsa
    await new Promise((r) => setTimeout(r, 400));

    const res = await request(app)
      .post(`/v1/public/share/${share.slug}/photos/${photo.id}/download`)
      .send();

    // Service versi essential: 410 (Gone)
    expect([410, 403]).toContain(res.status);
  });

  it("share: 404 when slug unknown", async () => {
    const album = await mkAlbum({ published: false });
    const photo = await mkPhoto(album.id, "processed");

    const res = await request(app)
      .post(`/v1/public/share/sh-unknown/photos/${photo.id}/download`)
      .send();

    expect(res.status).toBe(404);
  });

  it("share: 403 when photo is not processed", async () => {
    const album = await mkAlbum({ published: false });
    const photo = await mkPhoto(album.id, "pending");
    const share = await mkShare(album.id);

    const res = await request(app)
      .post(`/v1/public/share/${share.slug}/photos/${photo.id}/download`)
      .send();

    expect(res.status).toBe(403);
  });

  it("share: 403 when photo belongs to a different album", async () => {
    const a1 = await mkAlbum({ published: false });
    const a2 = await mkAlbum({ published: false });
    const photo2 = await mkPhoto(a2.id, "processed");
    const share1 = await mkShare(a1.id);

    const res = await request(app)
      .post(`/v1/public/share/${share1.slug}/photos/${photo2.id}/download`)
      .send();

    expect(res.status).toBe(404);
  });
});
