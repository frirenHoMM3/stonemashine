import Link from "next/link";
import { productFormLookups } from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Новый товар" };

export default async function NewProduct() {
  const lookups = await productFormLookups();
  return (
    <div>
      <Link href="/admin" className="label hover:text-bone">← Товары</Link>
      <h1 className="h-display mt-3 mb-10 text-5xl">Новый товар</h1>
      <ProductForm
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
