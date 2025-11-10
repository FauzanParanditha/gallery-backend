import sharp from "sharp";

export type ThumbResult = {
  buffer: Buffer;
  width: number;
  height: number;
  mime: "image/jpeg" | "image/png" | "image/webp";
};

export async function makeThumbnail(
  src: Buffer,
  maxSize = 960
): Promise<ThumbResult> {
  const base = sharp(src, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const format: ThumbResult["mime"] =
    meta.format === "png"
      ? "image/png"
      : meta.format === "webp"
      ? "image/webp"
      : "image/jpeg";

  const resized = base.resize({
    width: maxSize,
    height: maxSize,
    fit: "inside",
    withoutEnlargement: true,
  });
  const out =
    format === "image/png"
      ? await resized.png({ compressionLevel: 8 }).toBuffer()
      : format === "image/webp"
      ? await resized.webp({ quality: 82 }).toBuffer()
      : await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

  const dim = await sharp(out).metadata();
  return {
    buffer: out,
    width: dim.width ?? 0,
    height: dim.height ?? 0,
    mime: format,
  };
}
