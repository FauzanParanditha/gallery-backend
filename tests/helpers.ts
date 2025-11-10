import { createApp } from "@/app";
import { prisma } from "@/libs/prisma";
import bcrypt from "bcryptjs";
import request from "supertest";

export const app = createApp();

function toArray<T>(val: T | T[] | undefined | null): T[] {
  return Array.isArray(val) ? val : val != null ? [val] : [];
}

export async function seedAdmin(
  email = "admin@example.com",
  password = "Admin123!"
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "admin" },
  });
  return { user, email, password };
}

export function extractCookies(res: request.Response) {
  const raw = res.headers["set-cookie"] as string | string[] | undefined;
  const cookies = toArray(raw); // <-- sudah pasti string[]
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

export async function loginAndGetCookie(
  agent = request(app),
  email?: string,
  password?: string
) {
  const seeded = await seedAdmin(email, password);
  const res = await agent
    .post("/v1/auth/login")
    .send({ email: seeded.email, password: seeded.password });
  const cookie = extractCookies(res);
  return { cookie, user: seeded.user };
}

export async function createAlbum(
  agentCookie: string,
  payload?: Partial<{ title: string; slug: string }>
) {
  const body = {
    title: payload?.title || "Album Satu",
    slug: payload?.slug || "album-satu",
    description: "desc",
    isPublished: false,
  };
  const res = await request(app)
    .post("/v1/albums")
    .set("Cookie", agentCookie)
    .send(body);
  return res.body.data as { id: string; slug: string };
}
