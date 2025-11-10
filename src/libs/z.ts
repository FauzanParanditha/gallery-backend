import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z as baseZ } from "zod";

// Suntikkan .openapi() ke instance zod yang kita pakai di proyek
extendZodWithOpenApi(baseZ);

// Ekspor 'z' yang sudah di-extend
export const z = baseZ;
