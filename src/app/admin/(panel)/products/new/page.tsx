import Link from "next/link";
import { productFormLookups } from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Новый товар" };

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [{ saved }, lookups] = await Promise.all([searchParams, productFormLookups()]);
  return (
    <div>
      <Link href="/admin/products" className="label hover:text-bone">← Все товары</Link>
      <h1 className="h-display mt-2 mb-6 text-4xl sm:text-5xl">Новый товар</h1>
      {saved && (
        <div className="animate-rise mb-6 border-l-2 border-ok bg-ok/10 px-4 py-3 text-sm">
          ✓ «{saved}» сохранён. Заполняйте следующий.
        </div>
      )}
      <ProductForm
        key={saved ?? "new"}
        {...lookups}
        p={{
          id: null, title: "", slug: "", avitoUrl: "", sku: "", oem: "", brand: "", carMake: "", carModel: "",
          yearFrom: "", yearTo: "", price: "", oldPrice: "", priceNote: "", condition: "USED", conditionNote: "",
          categoryId: "", description: "", inStock: true, featured: false, published: true, images: [], specs: [], sections: [],
        }}
      />
    </div>
  );
}
