import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers["x-request-id"]?.toString() || randomUUID();
  (req as any).requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
