import { prisma } from "@/libs/prisma";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "./helpers";

describe("Health endpoints", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET /health should return db & queue ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body?.data?.db).toBe("ok");
    expect(res.body?.data?.queue?.ok).toBeTypeOf("boolean");
  });

  it("GET /health/storage should return ok true/false", async () => {
    const res = await request(app).get("/health/storage").expect(200);
    expect(res.body?.data?.bucket ?? res.body?.bucket).toBeDefined();
  });
});
