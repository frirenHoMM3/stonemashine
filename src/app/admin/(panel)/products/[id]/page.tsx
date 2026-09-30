import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseSections, parseSpecs } from "@/lib/format";
import { productFormLookups } from "@/lib/admin-data";
import { restoreProduct } from "../../../actions";
import { IconExternal } from "@/components/icons";
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
      <Link href="/admin/products" className="label hover:text-bone">← Все товары</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h1 className="h-display min-w-0 break-words text-3xl sm:text-5xl">{p.title}</h1>
        {p.published && !p.deletedAt && (
          <Link href={`/catalog/${p.slug}`} target="_blank" className="btn btn-ghost btn-sm">
            Открыть на сайте <IconExternal width={14} />
          </Link>
        )}
      </div>
      <div className="-mt-3 mb-6 font-mono text-xs text-smoke">
        изменён {p.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })} · {p.views} просмотров
      </div>
      {p.deletedAt && (
        <form action={restoreProduct} className="mb-6 flex flex-wrap items-center gap-3 border-l-2 border-red bg-red/10 px-4 py-3 text-sm">
          <input type="hidden" name="id" value={p.id} />
          Товар в корзине и не виден на сайте.
          <button className="btn btn-ghost btn-sm">Вернуть из корзины</button>
        </form>
      )}
      <ProductForm
        {...lookups}
        p={{
          id: p.id, title: p.title, slug: p.slug, avitoUrl: s(p.avitoUrl), sku: s(p.sku), oem: s(p.oem),
          brand: s(p.brand), carMake: s(p.carMake), carModel: s(p.carModel), yearFrom: s(p.yearFrom),
          yearTo: s(p.yearTo), price: s(p.price), oldPrice: s(p.oldPrice), priceNote: s(p.priceNote),
          condition: p.condition, conditionNote: s(p.conditionNote),
          categoryId: s(p.categoryId), description: s(p.description), inStock: p.inStock,
          featured: p.featured, published: p.published,
          images: p.images.map(({ file, width, height }) => ({ file, width, height })),
          specs: parseSpecs(p.specs),
          sections: parseSections(p.sections),
        }}
      />
    </div>
  );
}
