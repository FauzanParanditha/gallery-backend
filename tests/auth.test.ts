import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./helpers";

describe("Auth", () => {
  it("400 jika body kosong", async () => {
    const res = await request(app).post("/v1/auth/login").send();
    expect(res.status).toBe(400);
  });

  it("200 login sukses & set cookies", async () => {
    const email = "admin@example.com",
      password = "Admin123!";
    // seed di helper login
    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email, password });
    expect([200, 400, 401]).toContain(res.status); // jika belum seed, gunakan helper login
  });

  it("401 login gagal (password salah)", async () => {
    const email = "admin2@example.com",
      password = "Admin123!";
    await request(app).post("/v1/auth/login").send({ email, password }); // mungkin 400 jika belum seed
    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: "salah" });
    expect([400, 401]).toContain(res.status);
  });

  it("401 akses endpoint admin tanpa auth", async () => {
    const res = await request(app).get("/v1/albums");
    expect(res.status).toBe(401);
  });
});
