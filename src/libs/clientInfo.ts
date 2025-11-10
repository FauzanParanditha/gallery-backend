import type { Request } from "express";

export function getClientInfo(req: Request) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;
  const userAgent = req.headers["user-agent"]?.toString();
  return { ipAddress: ip, userAgent };
}
