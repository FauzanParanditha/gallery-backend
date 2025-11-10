import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./helpers";

describe("Error shape & 404", () => {
  it("returns consistent 404 for unknown route", async () => {
    const res = await request(app).get("/nope/route").expect(404);
    expect(res.body?.error?.code).toBe("NOT_FOUND");
    expect(typeof res.body?.error?.message).toBe("string");
  });

  //   it("returns 400 for invalid JSON", async () => {
  //     const res = await request(app)
  //       .post("/v1/albums") // atau endpoint lain yang expect JSON
  //       .set("Content-Type", "application/json")
  //       .send('{"oops":'); // rusak

  //     console.log(res.body);
  //     expect(res.status).toBe(400);
  //     expect(res.body?.error?.code).toBe("BAD_REQUEST");
  //   });
});
