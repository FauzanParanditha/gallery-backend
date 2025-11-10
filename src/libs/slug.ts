import crypto from "crypto";
export function randomSlug(len = 16) {
  return crypto
    .randomBytes(Math.ceil(len / 2))
    .toString("hex")
    .slice(0, len);
}
