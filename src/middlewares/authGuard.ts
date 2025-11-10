import { ENV } from "@/config/env";
import { Unauthorized } from "@/libs/errors";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface RequestUser {
  id: string;
  role: "admin";
}
export function authGuard(req: Request, _res: Response, next: NextFunction) {
  const token =
    req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) throw Unauthorized();
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as RequestUser;
    (req as any).user = payload;
    next();
  } catch {
    throw Unauthorized();
  }
}
