import { z } from "@/libs/z";
import type { z as zod } from "zod";

export const LoginDto = z
  .object({
    email: z.string().email().openapi({ example: "admin@example.com" }),
    password: z.string().min(6).openapi({ example: "Admin123!" }),
  })
  .openapi("LoginDto");

export const LoginResponse = z
  .object({
    user: z.object({
      id: z.string().cuid(),
      email: z.string().email(),
    }),
  })
  .openapi("LoginResponse");

export type LoginInput = zod.infer<typeof LoginDto>;
