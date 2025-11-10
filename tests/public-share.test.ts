import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, createAlbum, loginAndGetCookie } from "./helpers";

describe("Public download & share", () => {
  it("403 download jika album belum published", async () => {
    const { cookie } = await loginAndGetCookie();
    const album = await createAlbum(cookie, { title: "A2", slug: "a2" });

    // buat foto
    const pres = await request(app)
      .post("/v1/photos/presign")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        fileName: "a.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1000,
      });
    const keyOriginal = pres.body.data.keyOriginal;
    const conf = await request(app)
      .post("/v1/photos/confirm")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        keyOriginal,
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      });
    const photoId = conf.body.data.id;

    // publik download harus 403 (belum publish)
    const pub = await request(app)
      .post(`/v1/public/photos/${photoId}/download`)
      .send();
    expect([403, 404]).toContain(pub.status);
  });

  it("200 download publik jika published & allowDownload", async () => {
    const { cookie } = await loginAndGetCookie();
    const album = await createAlbum(cookie, { title: "A3", slug: "a3" });

    await request(app)
      .patch(`/v1/albums/${album.id}/publish`)
      .set("Cookie", cookie)
      .send({ isPublished: true });
    await request(app)
      .patch(`/v1/albums/${album.id}/privacy`)
      .set("Cookie", cookie)
      .send({ allowDownload: true, isPublic: true });

    const pres = await request(app)
      .post("/v1/photos/presign")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        fileName: "b.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1000,
      });
    const keyOriginal = pres.body.data.keyOriginal;
    const conf = await request(app)
      .post("/v1/photos/confirm")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        keyOriginal,
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      });
    const photoId = conf.body.data.id;

    const pub = await request(app)
      .post(`/v1/public/photos/${photoId}/download`)
      .send();
    expect(pub.status).toBe(200);
    expect(pub.body?.data?.url).toContain("https://");
  });

  it("Share: create (admin) → open (public) → download via share", async () => {
    const { cookie } = await loginAndGetCookie();
    const album = await createAlbum(cookie, { title: "A4", slug: "a4" });

    // privacy: allowShare & allowDownload
    await request(app)
      .patch(`/v1/albums/${album.id}/privacy`)
      .set("Cookie", cookie)
      .send({ allowShare: true, allowDownload: true });

    // foto
    const pres = await request(app)
      .post("/v1/photos/presign")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        fileName: "c.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1000,
      });
    const keyOriginal = pres.body.data.keyOriginal;
    const conf = await request(app)
      .post("/v1/photos/confirm")
      .set("Cookie", cookie)
      .send({
        albumId: album.id,
        keyOriginal,
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      });
    const photoId = conf.body.data.id;

    // create share
    const sh = await request(app)
      .post(`/v1/share/albums/${album.id}`)
      .set("Cookie", cookie)
      .send({ note: "press" });
    expect(sh.status).toBe(201);
    const slug = sh.body.data.slug;

    // open public
    const open = await request(app).get(`/v1/share/${slug}`).send();
    expect(open.status).toBe(200);

    // download via share
    const dls = await request(app)
      .post(`/v1/public/share/${slug}/photos/${photoId}/download`)
      .send();
    expect(dls.status).toBe(200);
    expect(dls.body?.data?.url).toContain("https://");
  });
});
