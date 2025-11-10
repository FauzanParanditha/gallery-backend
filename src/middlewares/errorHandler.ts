import { AppError, errorBody } from "@/libs/errors";
import { logger } from "@/libs/logger";
import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const rid = (req as any).requestId as string | undefined;

  // Zod validation error
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join("."),
      code: i.code,
      message: i.message,
      expected: (i as any).expected,
      received: (i as any).received,
    }));
    logger.warn(
      { rid, err: { name: "ZodError", details } },
      "Validation error"
    );
    return res.status(400).json({
      error: "ValidationError",
      message: "Invalid input",
      details,
      requestId: rid,
    });
  }

  // AppError kustom
  if (err instanceof AppError) {
    logger.info(
      { rid, err: { code: err.code, message: err.message } },
      "AppError"
    );
    return res.status(err.status).json({
      error: err.code || "AppError",
      message: err.message,
      requestId: rid,
    });
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let status = 400;
    let message = "Database error";
    if (err.code === "P2002") {
      status = 409;
      message = "Conflict: unique constraint violation";
    } else if (err.code === "P2025") {
      status = 404;
      message = "Record not found";
    }
    logger.warn(
      { rid, err: { code: err.code, meta: err.meta } },
      "Prisma error"
    );
    return res
      .status(status)
      .json({ error: "PrismaError", message, requestId: rid });
  }

  // JWT errors (akses kadaluwarsa/invalid)
  if (
    err instanceof jwt.JsonWebTokenError ||
    err instanceof jwt.TokenExpiredError
  ) {
    logger.warn(
      { rid, err: { name: err.name, message: err.message } },
      "JWT error"
    );
    return res
      .status(401)
      .json({ error: "Unauthorized", message: err.message, requestId: rid });
  }

  // Rate limiter (express-rate-limit)
  // @ts-ignore: type by lib
  if ((err as any)?.status === 429) {
    logger.warn({ rid }, "Too many requests");
    return res.status(429).json({
      error: "TooManyRequests",
      message: "Rate limit exceeded",
      requestId: rid,
    });
  }

  // Fallback
  const e = err as Error;
  logger.error(
    { rid, err: { name: e?.name, message: e?.message, stack: e?.stack } },
    "Unhandled error"
  );
  return res.status(500).json({
    error: "InternalServerError",
    message: "Internal Server Error",
    requestId: rid,
  });
}

export const notFoundHandler = (_req: Request, res: Response) => {
  return res.status(404).json(
    errorBody({
      code: "NOT_FOUND",
      message: "Route not found",
      status: 404,
    } as any)
  );
};
