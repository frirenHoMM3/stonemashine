import "server-only";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const SIZES = { lg: 1600, sm: 640 } as const;
export type ImageSize = keyof typeof SIZES;

export function mediaUrl(file: string, size: ImageSize = "lg") {
  return `/media/${file}-${size}.webp`;
}

// Перекодируем всё в webp: отрезает EXIF (геометки с телефона), чинит ориентацию,
// и заодно отсекает всё, что не является картинкой.
export async function saveImage(input: Buffer) {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new Error("Файл больше 15 МБ");
  await mkdir(UPLOAD_DIR, { recursive: true });

  const base = sharp(input, { failOn: "error", limitInputPixels: 60_000_000 }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Не удалось прочитать изображение");

  const file = `${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
  let width = 0;
  let height = 0;

  for (const [size, max] of Object.entries(SIZES) as [ImageSize, number][]) {
    const { data, info } = await base
      .clone()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .webp({ quality: size === "lg" ? 82 : 76 })
      .toBuffer({ resolveWithObject: true });
    await writeFile(path.join(UPLOAD_DIR, `${file}-${size}.webp`), data);
    if (size === "lg") ({ width, height } = info);
  }
  return { file, width, height };
}

export async function deleteImage(file: string) {
  if (!/^[a-z0-9]+$/.test(file)) return;
  await Promise.all(
    (Object.keys(SIZES) as ImageSize[]).map((s) =>
      unlink(path.join(UPLOAD_DIR, `${file}-${s}.webp`)).catch(() => {}),
    ),
  );
}
