import Link from "next/link";
import { db } from "@/lib/db";
import { deleteCategory, moveCategory } from "../../actions";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { ConfirmButton } from "@/components/admin/ui";
import { IconDown, IconUp } from "@/components/icons";

export const metadata = { title: "Категории" };

export default async function Categories() {
  const cats = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="h-display text-4xl sm:text-5xl">Категории</h1>
      <p className="mt-2 text-sm text-ash">В этом порядке категории стоят на главной и в фильтре каталога. Название можно поменять прямо в строке.</p>

      <div className="mt-8 border border-line bg-coal p-4">
        <div className="label mb-2">Новая категория</div>
        <CategoryForm />
      </div>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {cats.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-start gap-2 py-2 sm:flex-nowrap">
            <div className="flex shrink-0 flex-col">
              <Move id={c.id} dir={-1} disabled={i === 0} />
              <Move id={c.id} dir={1} disabled={i === cats.length - 1} />
            </div>
            <CategoryForm c={c} />
            <Link
              href={`/admin/products?cat=${c.id}`}
              className="flex h-10 shrink-0 items-center px-2 font-mono text-xs text-smoke hover:text-bone"
              title="Показать товары этой категории"
            >
              {c._count.products} шт.
            </Link>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton className="btn btn-ghost btn-sm h-10 w-28" confirm="Точно?">Удалить</ConfirmButton>
            </form>
          </li>
        ))}
        {!cats.length && <li className="py-10 text-center text-sm text-smoke">Категорий пока нет — добавьте первую выше</li>}
      </ul>
      {cats.length > 0 && (
        <p className="mt-3 text-xs text-smoke">При удалении категории товары остаются — просто без категории.</p>
      )}
    </div>
  );
}

function Move({ id, dir, disabled }: { id: string; dir: 1 | -1; disabled: boolean }) {
  return (
    <form action={moveCategory}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      <button
        disabled={disabled}
        aria-label={dir < 0 ? "Выше" : "Ниже"}
        className="flex h-5 w-8 items-center justify-center text-smoke hover:text-bone disabled:opacity-15"
      >
        {dir < 0 ? <IconUp width={13} /> : <IconDown width={13} />}
      </button>
    </form>
  );
}
