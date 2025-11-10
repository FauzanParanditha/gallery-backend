// src/libs/jwt.ts
import { ENV } from "@/config/env";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

type JwtPayload = { id: string; role: "admin" };

const JWT_SECRET: Secret = ENV.JWT_SECRET;

// Normalisasi expiresIn agar sesuai tipe SignOptions['expiresIn'] (string | number)
const ACCESS_TTL: SignOptions["expiresIn"] = (process.env.JWT_EXPIRES_IN ??
  "15m") as SignOptions["expiresIn"];
const REFRESH_TTL: SignOptions["expiresIn"] = (process.env.REFRESH_EXPIRES_IN ??
  "30d") as SignOptions["expiresIn"];

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken<T = JwtPayload>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL });
}
