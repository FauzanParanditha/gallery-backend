// src/docs/openapi.ts
import { z } from "@/libs/z";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

// ====== Import DTO dari modul ======
// Auth
import { LoginDto, LoginResponse } from "@/modules/auth/auth.schema";
// Albums
import { AlbumEntity, CreateAlbumDto } from "@/modules/albums/album.schema";
// Photos
import {
  ConfirmDto,
  PresignDto,
  PresignResponse,
  UpdatePhotoDto,
} from "@/modules/photos/photo.schema";

// ====== Common Schemas ======
const ApiError = z
  .object({
    error: z.string(),
    message: z.string().optional(),
    requestId: z.string().optional(),
  })
  .openapi("ApiError");

const IdParam = z.object({ id: z.string().min(1) }).openapi("IdParam");
const PhotoIdParam = z
  .object({ photoId: z.string().min(1) })
  .openapi("PhotoIdParam");
const AlbumIdParam = z
  .object({ albumId: z.string().min(1) })
  .openapi("AlbumIdParam");
const ShareSlugParam = z
  .object({ slug: z.string().min(1) })
  .openapi("ShareSlugParam");

// Entities (ringkas)
const PhotoEntity = z
  .object({
    id: z.string().cuid(),
    albumId: z.string(),
    keyOriginal: z.string(),
    keyThumb: z.string().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    checksum: z.string().nullable().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    sizeBytes: z.number().nullable().optional(),
    caption: z.string().nullable().optional(),
    isFeatured: z.boolean(),
    sortOrder: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Photo");

const ShareLinkEntity = z
  .object({
    id: z.string().cuid(),
    albumId: z.string(),
    slug: z.string(),
    note: z.string().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime(),
  })
  .openapi("ShareLink");

// Album privacy & publish
const AlbumPrivacyDto = z
  .object({
    isPublic: z.boolean().optional().openapi({ example: true }),
    allowDownload: z.boolean().optional().openapi({ example: true }),
    allowShare: z.boolean().optional().openapi({ example: true }),
    watermarkOn: z.boolean().optional().openapi({ example: false }),
    accessCode: z
      .string()
      .min(3)
      .max(100)
      .nullable()
      .optional()
      .openapi({ example: null }),
  })
  .openapi("AlbumPrivacyDto");

const PublishToggleDto = z
  .object({
    isPublished: z.boolean().openapi({ example: true }),
  })
  .openapi("PublishToggleDto");

// Responses
const PresignedGetResponse = z
  .object({
    data: z.object({ url: z.string().url() }),
  })
  .openapi("PresignedGetResponse");

const ListPhotosResponse = z
  .object({
    data: z.array(PhotoEntity),
  })
  .openapi("ListPhotosResponse");

const AlbumResponse = z.object({ data: AlbumEntity }).openapi("AlbumResponse");
const PhotoResponse = z.object({ data: PhotoEntity }).openapi("PhotoResponse");
const ShareLinkResponse = z
  .object({ data: ShareLinkEntity })
  .openapi("ShareLinkResponse");

const PublicAlbumListItem = AlbumEntity.pick({
  id: true,
  slug: true,
  title: true,
  description: true,
  eventDate: true,
  createdAt: true,
  updatedAt: true,
}).openapi("PublicAlbumListItem");

const PublicAlbumListResponse = z
  .object({
    data: z.array(PublicAlbumListItem),
  })
  .openapi("PublicAlbumListResponse");

const PublicAlbumBySlugResponse = z
  .object({
    data: AlbumEntity.extend({ photos: z.array(PhotoEntity) }),
  })
  .openapi("PublicAlbumBySlugResponse");

// Metrics
const MetricsPresignUserTodayQuery = z
  .object({
    userId: z.string().optional(),
    ip: z.string().optional(),
  })
  .openapi("MetricsPresignUserTodayQuery");

const MetricsPresignUserTodayResponse = z
  .object({
    data: z.object({
      total: z.number(),
      byAlbum: z.array(z.object({ albumId: z.string(), count: z.number() })),
    }),
  })
  .openapi("MetricsPresignUserTodayResponse");

export function buildOpenApi() {
  const registry = new OpenAPIRegistry();

  // ===== Security Schemes =====
  registry.registerComponent("securitySchemes", "CookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "token",
    description: "Access token JWT disimpan di httpOnly cookie 'token'.",
  });
  registry.registerComponent("securitySchemes", "BearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  // ===== Register Schemas =====
  registry.register("ApiError", ApiError);
  registry.register("Album", AlbumEntity);
  registry.register("Photo", PhotoEntity);
  registry.register("ShareLink", ShareLinkEntity);
  registry.register("AlbumPrivacyDto", AlbumPrivacyDto);
  registry.register("PublishToggleDto", PublishToggleDto);

  registry.register("LoginDto", LoginDto);
  registry.register("LoginResponse", LoginResponse);

  registry.register("CreateAlbumDto", CreateAlbumDto);
  registry.register("AlbumResponse", AlbumResponse);

  registry.register("PresignDto", PresignDto);
  registry.register("PresignResponse", PresignResponse);
  registry.register("ConfirmDto", ConfirmDto);
  registry.register("UpdatePhotoDto", UpdatePhotoDto);

  registry.register("PresignedGetResponse", PresignedGetResponse);
  registry.register("ListPhotosResponse", ListPhotosResponse);
  registry.register("PublicAlbumListItem", PublicAlbumListItem);
  registry.register("PublicAlbumListResponse", PublicAlbumListResponse);
  registry.register("PublicAlbumBySlugResponse", PublicAlbumBySlugResponse);

  registry.register(
    "MetricsPresignUserTodayQuery",
    MetricsPresignUserTodayQuery
  );
  registry.register(
    "MetricsPresignUserTodayResponse",
    MetricsPresignUserTodayResponse
  );

  // ===== Paths =====

  // --- Auth ---
  registry.registerPath({
    method: "post",
    path: "/auth/login",
    request: {
      body: { content: { "application/json": { schema: LoginDto } } },
    },
    responses: {
      200: {
        description: "Login success",
        content: { "application/json": { schema: LoginResponse } },
      },
      400: {
        description: "Invalid input",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Auth"],
    summary: "Login admin",
  });
  registry.registerPath({
    method: "post",
    path: "/auth/refresh",
    responses: {
      200: {
        description: "New access/refresh issued",
        content: { "application/json": { schema: LoginResponse } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Auth"],
    summary: "Refresh access token (via cookie refresh_token)",
  });
  registry.registerPath({
    method: "post",
    path: "/auth/logout",
    responses: { 204: { description: "Logged out" } },
    tags: ["Auth"],
    summary: "Logout & revoke session",
  });

  // --- Albums (admin) ---
  registry.registerPath({
    method: "post",
    path: "/albums",
    security: [{ CookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: CreateAlbumDto } } },
    },
    responses: {
      201: {
        description: "Album created",
        content: { "application/json": { schema: AlbumResponse } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Albums"],
    summary: "Create album",
  });
  registry.registerPath({
    method: "get",
    path: "/albums",
    security: [{ CookieAuth: [] }],
    responses: {
      200: {
        description: "List albums (admin)",
        content: {
          "application/json": {
            schema: z.object({ data: z.array(AlbumEntity) }),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Albums"],
    summary: "List albums (admin)",
  });
  registry.registerPath({
    method: "get",
    path: "/albums/{id}",
    security: [{ CookieAuth: [] }],
    request: { params: IdParam },
    responses: {
      200: {
        description: "Album detail",
        content: { "application/json": { schema: AlbumResponse } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Albums"],
    summary: "Get album detail (admin)",
  });
  registry.registerPath({
    method: "patch",
    path: "/albums/{id}",
    security: [{ CookieAuth: [] }],
    request: {
      params: IdParam,
      body: {
        content: { "application/json": { schema: CreateAlbumDto.partial() } },
      },
    },
    responses: {
      200: {
        description: "Album updated",
        content: { "application/json": { schema: AlbumResponse } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Albums"],
    summary: "Update album",
  });
  registry.registerPath({
    method: "delete",
    path: "/albums/{id}",
    security: [{ CookieAuth: [] }],
    request: { params: IdParam },
    responses: {
      204: { description: "Album deleted" },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Albums"],
    summary: "Delete album",
  });

  // --- Albums: publish toggle & privacy (admin) ---
  registry.registerPath({
    method: "patch",
    path: "/albums/{id}/publish",
    security: [{ CookieAuth: [] }],
    request: {
      params: IdParam,
      body: { content: { "application/json": { schema: PublishToggleDto } } },
    },
    responses: {
      200: {
        description: "Publish status updated",
        content: { "application/json": { schema: AlbumResponse } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Albums"],
    summary: "Toggle publish album",
  });
  registry.registerPath({
    method: "patch",
    path: "/albums/{id}/privacy",
    security: [{ CookieAuth: [] }],
    request: {
      params: IdParam,
      body: { content: { "application/json": { schema: AlbumPrivacyDto } } },
    },
    responses: {
      200: {
        description: "Privacy updated",
        content: { "application/json": { schema: AlbumResponse } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Albums"],
    summary: "Update album privacy",
  });

  // --- Albums: public listing/detail ---
  registry.registerPath({
    method: "get",
    path: "/public/albums",
    responses: {
      200: {
        description: "List published albums",
        content: { "application/json": { schema: PublicAlbumListResponse } },
      },
    },
    tags: ["Public"],
    summary: "Public albums listing (published only)",
  });
  registry.registerPath({
    method: "get",
    path: "/public/albums/{slug}",
    request: { params: z.object({ slug: z.string().min(1) }) },
    responses: {
      200: {
        description: "Public album by slug",
        content: { "application/json": { schema: PublicAlbumBySlugResponse } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Public"],
    summary: "Public album detail by slug (published only)",
  });

  // --- Photos (admin) ---
  registry.registerPath({
    method: "post",
    path: "/photos/presign",
    security: [{ CookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: PresignDto } } },
    },
    responses: {
      201: {
        description: "Presigned PUT URL",
        content: { "application/json": { schema: PresignResponse } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      429: {
        description: "Rate limit",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Photos"],
    summary: "Get presigned upload URL",
  });
  registry.registerPath({
    method: "post",
    path: "/photos/confirm",
    security: [{ CookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: ConfirmDto } } },
    },
    responses: {
      201: {
        description: "Photo saved",
        content: { "application/json": { schema: PhotoResponse } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Photos"],
    summary: "Confirm uploaded photo (write metadata)",
  });
  registry.registerPath({
    method: "get",
    path: "/photos/album/{albumId}",
    security: [{ CookieAuth: [] }],
    request: { params: AlbumIdParam },
    responses: {
      200: {
        description: "List photos by album",
        content: { "application/json": { schema: ListPhotosResponse } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Photos"],
    summary: "List photos (admin)",
  });
  registry.registerPath({
    method: "patch",
    path: "/photos/{id}",
    security: [{ CookieAuth: [] }],
    request: {
      params: IdParam,
      body: { content: { "application/json": { schema: UpdatePhotoDto } } },
    },
    responses: {
      200: {
        description: "Photo updated",
        content: { "application/json": { schema: PhotoResponse } },
      },
      400: {
        description: "Validation error",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Photos"],
    summary: "Update photo (caption/featured/sortOrder)",
  });
  registry.registerPath({
    method: "delete",
    path: "/photos/{id}",
    security: [{ CookieAuth: [] }],
    request: { params: IdParam },
    responses: {
      204: { description: "Photo deleted" },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Photos"],
    summary: "Delete photo",
  });

  // --- Public download (direct) ---
  registry.registerPath({
    method: "post",
    path: "/public/photos/{photoId}/download",
    request: { params: PhotoIdParam },
    responses: {
      200: {
        description: "Presigned GET URL",
        content: { "application/json": { schema: PresignedGetResponse } },
      },
      403: {
        description: "Forbidden (privacy/published)",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
      429: {
        description: "Rate limit",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Public"],
    summary: "Download photo (public, logged)",
  });

  // --- Share (admin + public) ---
  // Create share link
  registry.registerPath({
    method: "post",
    path: "/share/albums/{albumId}",
    security: [{ CookieAuth: [] }],
    request: {
      params: AlbumIdParam,
      body: {
        content: {
          "application/json": {
            schema: z
              .object({
                note: z.string().optional(),
                expiresAt: z.string().datetime().optional(),
              })
              .openapi("CreateShareDto"),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Share link created",
        content: { "application/json": { schema: ShareLinkResponse } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      403: {
        description: "Share disabled",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Album not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Share"],
    summary: "Create share link for album",
  });

  // List share links for an album (admin)
  registry.registerPath({
    method: "get",
    path: "/share/albums/{albumId}",
    security: [{ CookieAuth: [] }],
    request: { params: AlbumIdParam },
    responses: {
      200: {
        description: "List share links for album",
        content: {
          "application/json": {
            schema: z.object({ data: z.array(ShareLinkEntity) }),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Share"],
    summary: "List share links (admin)",
  });

  // Delete share link by slug (admin)
  registry.registerPath({
    method: "delete",
    path: "/share/{slug}",
    security: [{ CookieAuth: [] }],
    request: { params: ShareSlugParam },
    responses: {
      204: { description: "Share link deleted" },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Share"],
    summary: "Delete share link (admin)",
  });

  // Open share (public)
  registry.registerPath({
    method: "get",
    path: "/share/{slug}",
    request: { params: ShareSlugParam },
    responses: {
      200: {
        description: "Resolve share link & album content",
        content: {
          "application/json": {
            schema: z.object({
              data: z.object({
                link: ShareLinkEntity,
                album: AlbumEntity.extend({ photos: z.array(PhotoEntity) }),
              }),
            }),
          },
        },
      },
      403: {
        description: "Share disabled or expired",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Share not found",
        content: { "application/json": { schema: ApiError } },
      },
      429: {
        description: "Rate limit",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Share"],
    summary: "Open album via share slug (public view)",
  });

  // Public download via share
  registry.registerPath({
    method: "post",
    path: "/public/share/{slug}/photos/{photoId}/download",
    request: { params: ShareSlugParam.merge(PhotoIdParam) },
    responses: {
      200: {
        description: "Presigned GET URL",
        content: { "application/json": { schema: PresignedGetResponse } },
      },
      403: {
        description: "Forbidden (privacy/share disabled/expired)",
        content: { "application/json": { schema: ApiError } },
      },
      404: {
        description: "Not found",
        content: { "application/json": { schema: ApiError } },
      },
      429: {
        description: "Rate limit",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Public"],
    summary: "Download photo via share link",
  });

  // --- Metrics (admin) ---
  registry.registerPath({
    method: "get",
    path: "/metrics/presign-user-today",
    security: [{ CookieAuth: [] }],
    request: { query: MetricsPresignUserTodayQuery },
    responses: {
      200: {
        description: "Presign count for user/ip today",
        content: {
          "application/json": { schema: MetricsPresignUserTodayResponse },
        },
      },
      400: {
        description: "Bad request (need userId or ip)",
        content: { "application/json": { schema: ApiError } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ApiError } },
      },
    },
    tags: ["Metrics"],
    summary: "Read presign metrics (today) by userId or ip",
  });

  // ==== Build document ====
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: { title: "Gallery API", version: "1.0.0" },
    servers: [{ url: "/v1" }],
    tags: [
      { name: "Auth" },
      { name: "Albums" },
      { name: "Photos" },
      { name: "Public" },
      { name: "Share" },
      { name: "Metrics" },
    ],
  });
}
