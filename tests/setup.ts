import { prisma } from "@/libs/prisma";
import "dotenv/config";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// MOCK: S3 presign supaya stabil (sesuaikan dengan signature baru) matikan jika ingin E2E
// vi.mock("@/libs/s3", () => ({
//   presignPut: vi.fn(
//     async (key: string, _opts?: { contentType?: string; [k: string]: any }) =>
//       `https://obj.test/upload/${encodeURIComponent(key)}?sig=1`
//   ),
//   presignGet: vi.fn(
//     async (key: string, _exp?: number) =>
//       `https://obj.test/download/${encodeURIComponent(key)}?sig=1`
//   ),
// }));

// MOCK: rate limiter jadi no-op (biar tidak flaky)
vi.mock("@/middlewares/rateLimiters", () => ({
  limitPublicDownload: (_req: any, _res: any, next: any) => next(),
  limitShareDownload: (_req: any, _res: any, next: any) => next(),
  limitShareOpen: (_req: any, _res: any, next: any) => next(),
  limitPresign: (_req: any, _res: any, next: any) => next(),
}));

beforeAll(async () => {
  await prisma.downloadLog.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.photoTag.deleteMany();
  await prisma.albumTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.album.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterEach(async () => {});

afterAll(async () => {
  await prisma.downloadLog.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.photoTag.deleteMany();
  await prisma.albumTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.album.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
