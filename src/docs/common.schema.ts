// src/docs/common.schema.ts
import { z } from "@/libs/z";

export const ApiError = z
  .object({
    error: z.string(),
    message: z.string().optional(),
    requestId: z.string().optional(),
  })
  .openapi("ApiError");

export const PaginationQuery = z
  .object({
    page: z.string().optional().openapi({ example: "1" }),
    pageSize: z.string().optional().openapi({ example: "24" }),
  })
  .openapi("PaginationQuery");
