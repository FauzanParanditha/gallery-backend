import { AlbumRepo } from "@/modules/albums/album.repo";
import { PhotoService } from "@/modules/photos/photo.service";

import { beforeEach, describe, expect, it, vi } from "vitest";

const presignSvc = PhotoService.presign;

beforeEach(() => vi.restoreAllMocks());

describe("photo.service.presign()", () => {
  it("returns keyOriginal + signed uploadUrl (mocked S3)", async () => {
    vi.spyOn(AlbumRepo, "findById").mockResolvedValue({
      id: "alb-1",
      title: "Mock",
    } as any);

    const input = {
      albumId: "alb-1",
      fileName: "a.jpg",
      contentType: "image/jpeg",
    };
    const { keyOriginal, uploadUrl } = await presignSvc(input as any);

    expect(keyOriginal).toMatch(/^albums\/alb-1\/original\//);
    expect(uploadUrl).toMatch(/^https:\/\/obj\.test\/upload\//);
    expect(uploadUrl).toContain(encodeURIComponent(keyOriginal));
    expect(uploadUrl).toMatch(/[?&]sig=/);
  });

  it("throws when album not found", async () => {
    vi.spyOn(AlbumRepo, "findById").mockResolvedValue(null);
    await expect(
      presignSvc({
        albumId: "x",
        fileName: "a.jpg",
        contentType: "image/jpeg",
      } as any)
    ).rejects.toThrow(/Album tidak ditemukan/i);
  });

  it("fallback ext when fileName missing", async () => {
    vi.spyOn(AlbumRepo, "findById").mockResolvedValue({ id: "alb-1" } as any);
    const { keyOriginal } = await presignSvc({
      albumId: "alb-1",
      fileName: "",
      contentType: "image/png",
    } as any);
    expect(keyOriginal.endsWith(".png")).toBe(true);
  });
});
