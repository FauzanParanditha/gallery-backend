export class AppError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const BadRequest = (msg = "Bad request") => new AppError(msg, 400);
export const Unauthorized = (msg = "Unauthorized") => new AppError(msg, 401);
export const Forbidden = (msg = "Forbidden") => new AppError(msg, 403);
export const NotFound = (msg = "Not found") => new AppError(msg, 404);
export const Conflict = (msg = "Conflict") => new AppError(msg, 409);
export const Gone = (msg = "Gone") => new AppError(msg, 410);
export const TooMany = (msg = "Too many requests") => new AppError(msg, 429);

export const Internal = (msg = "Internal server error") =>
  new AppError(msg, 500);

type ErrLike = Error & { status?: number; code?: string; details?: any };

export function errorBody(err: ErrLike) {
  return {
    error: {
      code: err.code ?? "INTERNAL",
      message: err.message ?? "Internal server error",
      details: err.details ?? undefined,
    },
  };
}
