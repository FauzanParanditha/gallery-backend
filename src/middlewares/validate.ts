import type { NextFunction, Request, Response } from "express";
import z from "zod";

export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    req.body = parsed.data;
    next();
  };
}
export function validateQuery(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return next(parsed.error);
    req.query = parsed.data as any;
    next();
  };
}
export function validateParams(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) return next(parsed.error);
    req.params = parsed.data as any;
    next();
  };
}
