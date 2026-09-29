export type ImageSize = "lg" | "sm";

export function mediaUrl(file: string, size: ImageSize = "lg") {
  return `/media/${file}-${size}.webp`;
}
