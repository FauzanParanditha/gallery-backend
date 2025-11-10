import type { Album, Photo } from ".prisma/client";
import { prisma } from "@/libs/prisma";
import { randomUUID } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app, loginAndGetCookie } from "./helpers";

async function createAlbumDraft(): Promise<Album> {
  const slug = `act-${randomUUID().slice(0, 8)}`;
  return prisma.album.create({
    data: {
      slug,
      title: `Album ${slug}`,
      description: "for actions test",
      isPublished: false,
    },
  });
}

async function createPhoto(
  albumId: string,
  status: "pending" | "processed" | "error" = "processed"
): Promise<Photo> {
  const keyOriginal = `albums/${albumId}/original/${randomUUID()}.jpg`;
  return prisma.photo.create({
    data: {
      albumId,
      keyOriginal,
      keyThumb:
        status === "processed"
          ? `albums/${albumId}/thumb/${randomUUID()}.webp`
          : null,
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      sizeBytes: 100_000,
      status,
    },
  });
}

// ===== Suite =====
describe("Album actions (publish / unpublish / setCover)", () => {
  let cookie: string;
  let slug: string;
  let albumId: string;

  beforeAll(async () => {
    const session = await loginAndGetCookie(); // { cookie, user }
    cookie = session.cookie;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("POST /v1/albums — create 201", async () => {
    slug = `crud-${randomUUID().slice(0, 8)}`;
    const res = await request(app)
      .post("/v1/albums")
      .set("Cookie", cookie)
      .send({
        slug,
        title: "CRUD Test Album",
        description: "for CRUD tests",
        isPublished: false,
      });
    expect(res.status, res.text).toBe(201);
    expect(res.body?.data?.id).toBeDefined();
    albumId = res.body.data.id;
  });

  it("GET /v1/albums — list 200 (admin)", async () => {
    const res = await request(app)
      .get("/v1/albums?published=false")
      .set("Cookie", cookie)
      .expect(200);
    console.log(res.body);
    const items = res.body?.data ?? res.body;
    expect(Array.isArray(items)).toBe(true);
    const found = items.find((x: any) => x.id === albumId);
    expect(found).toBeTruthy();
  });

  it("GET /v1/albums/:id — detail 200", async () => {
    const res = await request(app)
      .get(`/v1/albums/${albumId}`)
      .set("Cookie", cookie)
      .expect(200);

    expect(res.body?.data?.id ?? res.body?.id).toBe(albumId);
  });

  it("PATCH /v1/albums/:id — update 200", async () => {
    const res = await request(app)
      .patch(`/v1/albums/${albumId}`)
      .set("Cookie", cookie)
      .send({ title: "CRUD Test Album (edited)" })
      .expect(200);

    const data = res.body?.data ?? res.body;
    expect(data.title).toMatch(/edited/i);
  });

  it("POST /v1/albums — duplicate slug should fail (409/400)", async () => {
    const res = await request(app)
      .post("/v1/albums")
      .set("Cookie", cookie)
      .send({
        slug, // sama dengan album sebelumnya
        title: "Duplicated Slug",
      });

    expect([400, 409]).toContain(res.status);
  });

  it("publish should fail (400) when album has no processed photo", async () => {
    await createPhoto(albumId, "pending");

    const res = await request(app)
      .post(`/v1/albums/${albumId}/publish`)
      .set("Cookie", cookie)
      .send();
    expect(res.status).toBe(400);
    expect(res.body?.message || res.body?.code || "").toMatch(
      /(belum|processed)/i
    );
  });

  it("publish should succeed (200) when album has at least one processed photo", async () => {
    await createPhoto(albumId, "processed"); // minimal satu ready

    const res = await request(app)
      .post(`/v1/albums/${albumId}/publish`)
      .set("Cookie", cookie)
      .send();

    expect(res.status, res.text).toBe(200);
    expect(res.body?.data?.isPublished).toBe(true);
  });

  it("setCover should fail (400) when photo is from different album", async () => {
    const albumA = await createAlbumDraft();
    const albumB = await createAlbumDraft();
    const photoB = await createPhoto(albumB.id, "processed");

    const res = await request(app)
      .post(`/v1/albums/${albumA.id}/cover/${photoB.id}`)
      .set("Cookie", cookie)
      .send();
    expect(res.status).toBe(400);
    expect(res.body?.message || res.body?.code || "").toMatch(
      /bukan milik album/i
    );
  });

  it("setCover should fail (400) when photo is not processed", async () => {
    const photo = await createPhoto(albumId, "pending");

    const res = await request(app)
      .post(`/v1/albums/${albumId}/cover/${photo.id}`)
      .set("Cookie", cookie)
      .send();

    expect(res.status).toBe(400);
    expect(res.body?.message || res.body?.code || "").toMatch(/processed/i);
  });

  it("setCover should succeed (200) with processed photo, then unpublish should set isPublished=false", async () => {
    const photo = await createPhoto(albumId, "processed");

    const resCover = await request(app)
      .post(`/v1/albums/${albumId}/cover/${photo.id}`)
      .set("Cookie", cookie)
      .send();

    expect(resCover.status, resCover.text).toBe(200);
    expect(resCover.body?.data?.coverPhotoId).toBe(photo.id);

    // publish dulu agar bisa lihat unpublish berubah
    await request(app)
      .post(`/v1/albums/${albumId}/publish`)
      .set("Cookie", cookie)
      .send()
      .expect(200);

    const resUnpub = await request(app)
      .post(`/v1/albums/${albumId}/unpublish`)
      .set("Cookie", cookie)
      .send();

    expect(resUnpub.status, resUnpub.text).toBe(200);
    expect(resUnpub.body?.data?.isPublished).toBe(false);
  });

  it("DELETE /v1/albums/:id — delete 204 then 404 on detail", async () => {
    await request(app)
      .delete(`/v1/albums/${albumId}`)
      .set("Cookie", cookie)
      .expect(204);

    await request(app)
      .get(`/v1/albums/${albumId}`)
      .set("Cookie", cookie)
      .expect(404);
  });
});
