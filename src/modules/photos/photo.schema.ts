import { z } from "@/libs/z";

const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const PresignDto = z
  .object({
    albumId: z.string().min(1).openapi({ example: "alb_123" }),
    fileName: z.string().min(1).openapi({ example: "IMG_0001.jpg" }),
    contentType: z.enum(allowed).openapi({ example: "image/jpeg" }),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024)
      .openapi({ example: 5242880 }),
  })
  .openapi("PresignDto");

export const PresignResponse = z
  .object({
    data: z.object({
      keyOriginal: z
        .string()
        .openapi({ example: "albums/alb_123/original/uuid.jpg" }),
      uploadUrl: z.string().url(),
    }),
  })
  .openapi("PresignResponse");

export const ConfirmDto = z.object({
  albumId: z.string().min(1),
  keyOriginal: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  checksum: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  caption: z.string().optional(),
});

export const UpdatePhotoDto = z.object({
  caption: z.string().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
