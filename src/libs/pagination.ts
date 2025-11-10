import { z } from "@/libs/z";
import zod from "zod";

export const PageQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PageQuery = zod.infer<typeof PageQuery>;
