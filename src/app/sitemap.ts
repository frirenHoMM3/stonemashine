import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { abs } from "@/lib/site";
import { mediaUrl } from "@/lib/uploads-url";

// Собирается на каждый запрос: новая карточка попадает в карту сразу после сохранения
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true, images: { select: { file: true }, orderBy: { sortOrder: "asc" }, take: 5 } },
      orderBy: { updatedAt: "desc" },
    }),
    db.category.findMany({ select: { slug: true, products: { where: { published: true }, select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 } } }),
  ]);
  const latest = products[0]?.updatedAt ?? new Date();

  return [
    { url: abs("/"), lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: abs("/catalog"), lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    ...categories
      .filter((c) => c.products.length)
      .map((c) => ({
        url: abs(`/catalog?cat=${c.slug}`),
        lastModified: c.products[0].updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ...products.map((p) => ({
      url: abs(`/catalog/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: p.images.map((i) => abs(mediaUrl(i.file, "lg"))),
    })),
  ];
}
