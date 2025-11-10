import { Response } from "express";

const ACCESS_COOKIE = "token";
const REFRESH_COOKIE = "refresh_token";

export const cookieNames = { ACCESS_COOKIE, REFRESH_COOKIE };

export function setAuthCookies(
  res: Response,
  access: string,
  refresh?: string
) {
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
  };

  res.cookie(ACCESS_COOKIE, access, { ...common, maxAge: 1000 * 60 * 15 }); // 15m
  if (refresh)
    res.cookie(REFRESH_COOKIE, refresh, {
      ...common,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    }); // 30d
}

export function clearAuthCookies(res: Response) {
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}
