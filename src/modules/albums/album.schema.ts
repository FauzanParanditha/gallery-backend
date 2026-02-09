import { z } from "@/libs/z";
import type { z as zod } from "zod";

export const CreateAlbumDto = z
  .object({
    title: z.string().min(1).openapi({ example: "Presscon Trailer" }),
    description: z.string().optional().openapi({ example: "Sesi foto media" }),
    eventDate: z
      .string()
      .datetime()
      .optional()
      .openapi({ example: "2025-10-22T14:00:00.000Z" }),
    slug: z.string().min(1).openapi({ example: "presscon-trailer" }),
    isPublished: z.boolean().optional().default(false),
    createdAt: z
      .string()
      .datetime()
      .optional()
      .openapi({ example: "2024-06-01T10:00:00.000Z" }),
    updatedAt: z
      .string()
      .datetime()
      .optional()
      .openapi({ example: "2024-06-01T10:00:00.000Z" }),
  })
  .openapi("CreateAlbumDto");

export const AlbumEntity = z
  .object({
    id: z.string().cuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    eventDate: z.string().datetime().nullable().optional(),
    coverPhotoId: z.string().nullable().optional(),
    isPublished: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Album");

export const AlbumId = z.string().min(1);

export const UpdateAlbumDto = CreateAlbumDto.partial();
export type CreateAlbumInput = zod.infer<typeof CreateAlbumDto>;
export type UpdateAlbumInput = zod.infer<typeof UpdateAlbumDto>;
