import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseSpecs } from "@/lib/format";
import { productFormLookups } from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Редактирование" };

const s = (v: string | number | null) => (v == null ? "" : String(v));

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, lookups] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: "asc" } } } }),
    productFormLookups(),
  ]);
  if (!p) notFound();

  return (
    <div>
      <Link href="/admin" className="label hover:text-bone">← Товары</Link>
      <div className="mt-3 mb-10 flex flex-wrap items-end justify-between gap-4">
        <h1 className="h-display text-5xl">{p.title}</h1>
        <div className="font-mono text-xs text-smoke">
          создан {p.createdAt.toLocaleDateString("ru-RU")} · изменён {p.updatedAt.toLocaleString("ru-RU")} · {p.views} просм.
        </div>
      </div>
      <ProductForm
        {...lookups}
        p={{
          id: p.id, title: p.title, slug: p.slug, avitoUrl: p.avitoUrl, sku: s(p.sku), oem: s(p.oem),
          brand: s(p.brand), carMake: s(p.carMake), carModel: s(p.carModel), yearFrom: s(p.yearFrom),
          yearTo: s(p.yearTo), price: s(p.price), oldPrice: s(p.oldPrice), condition: p.condition,
          categoryId: s(p.categoryId), description: s(p.description), inStock: p.inStock,
          featured: p.featured, published: p.published,
          images: p.images.map(({ file, width, height }) => ({ file, width, height })),
          specs: parseSpecs(p.specs),
        }}
      />
    </div>
  );
}
