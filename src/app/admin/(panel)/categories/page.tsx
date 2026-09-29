import { db } from "@/lib/db";
import { deleteCategory } from "../../actions";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { ConfirmButton } from "@/components/admin/ui";

export const metadata = { title: "Категории" };

export default async function Categories() {
  const cats = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="max-w-4xl">
      <div className="label">Структура</div>
      <h1 className="h-display mt-2 text-5xl">Категории</h1>
      <p className="mt-3 max-w-xl text-sm text-ash">
        Показываются на главной и в фильтрах каталога. Меньше «порядок» — выше в списке.
        При удалении категории товары остаются, просто без категории.
      </p>

      <div className="mt-10 border border-line bg-coal p-5">
        <div className="label mb-3">Новая категория</div>
        <CategoryForm />
      </div>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {cats.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start gap-3 py-4 sm:flex-nowrap">
            <div className="flex-1"><CategoryForm c={c} /></div>
            <span className="flex h-10 items-center font-mono text-xs text-smoke">{c._count.products} шт.</span>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton className="btn btn-ghost btn-sm h-10 w-24" confirm="Удалить!">Удалить</ConfirmButton>
            </form>
          </li>
        ))}
        {!cats.length && <li className="py-10 text-center text-sm text-smoke">Категорий пока нет</li>}
      </ul>
    </div>
  );
}
