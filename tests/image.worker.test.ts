// tests/image.worker.test.ts
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/libs/s3", () => ({
  getObjectBufferWithRetry: vi.fn(),
  putObjectBufferWithRetry: vi.fn(),
}));

// Prisma mock: hanya method yang dipakai
vi.mock("@/libs/prisma", () => ({
  prisma: {
    photo: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/libs/prisma";
import { getObjectBufferWithRetry, putObjectBufferWithRetry } from "@/libs/s3";
import {
  processThumbnail,
  type ProcessJobData,
} from "../workers/image.processor";

const prismaFind = prisma.photo.findUnique as unknown as Mock;
const prismaUpdate = prisma.photo.update as unknown as Mock;
const s3Get = getObjectBufferWithRetry as unknown as Mock;
const s3Put = putObjectBufferWithRetry as unknown as Mock;

const ALB_ID = "clm0u2w7p0000abcde123456";
const BASE_JOB: ProcessJobData = {
  photoId: "ph_123",
  albumId: ALB_ID,
  keyOriginal: `albums/${ALB_ID}/original/abc.jpg`,
};

async function makeTinyJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 6,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processThumbnail()", () => {
  it("success: generates webp thumbnail, uploads, and updates DB", async () => {
    // prisma find → belum punya thumb
    prismaFind.mockResolvedValue({
      keyThumb: null,
      width: null,
      height: null,
      mimeType: null,
      keyOriginal: BASE_JOB.keyOriginal,
    });

    // s3 get → buffer jpeg kecil
    s3Get.mockResolvedValue(await makeTinyJpeg());

    // s3 put → ok
    s3Put.mockResolvedValue(undefined);

    const res = await processThumbnail(BASE_JOB);

    // memastikan s3 put dipanggil dgn /thumb/ dan ekstensi .webp
    const [putKey, putBuf, putCtype] = s3Put.mock.calls[0] as any[];
    expect(putKey).toMatch(new RegExp(`^albums/${ALB_ID}/thumb/abc\\.webp$`));
    expect(Buffer.isBuffer(putBuf)).toBe(true);
    expect(putCtype).toBe("image/webp");

    // memastikan DB diupdate processed + keyThumb
    expect(prismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BASE_JOB.photoId },
        data: expect.objectContaining({
          keyThumb: putKey,
          status: "processed",
          lastError: null,
        }),
      })
    );

    // return value
    expect(res).toEqual(
      expect.objectContaining({
        keyThumb: putKey,
        bucket: expect.any(String),
      })
    );
  });

  it("error: S3 original NoSuchKey → marks photo as error", async () => {
    prismaFind.mockResolvedValue({
      keyThumb: null,
      width: null,
      height: null,
      mimeType: null,
      keyOriginal: BASE_JOB.keyOriginal,
    });

    s3Get.mockRejectedValue(new Error("NoSuchKey: not found"));

    await expect(processThumbnail(BASE_JOB)).rejects.toThrow(/NoSuchKey/i);

    // DB ter-update status error
    const calls = prismaUpdate.mock.calls.map((c) => c[0]);
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toEqual(
      expect.objectContaining({
        where: { id: BASE_JOB.photoId },
        data: expect.objectContaining({
          status: "error",
          lastError: expect.stringMatching(/NoSuchKey/i),
        }),
      })
    );

    // Tidak mengunggah thumb
    expect(s3Put).not.toHaveBeenCalled();
  });

  it("idempotent: skip if keyThumb already exists", async () => {
    prismaFind.mockResolvedValue({
      keyThumb: `albums/${ALB_ID}/thumb/abc.webp`,
      width: 100,
      height: 100,
      mimeType: "image/webp",
      keyOriginal: BASE_JOB.keyOriginal,
    });

    const res = await processThumbnail(BASE_JOB);

    expect(res).toEqual(
      expect.objectContaining({
        skipped: true,
        reason: "already_has_thumb",
      })
    );

    expect(s3Get).not.toHaveBeenCalled();
    expect(s3Put).not.toHaveBeenCalled();
  });
});
