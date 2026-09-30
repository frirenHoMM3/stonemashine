import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { conditionLabel, priceLabel } from "@/lib/format";
import { mediaUrl } from "@/lib/uploads-url";
import { deleteProduct, duplicateProduct, toggleProductFlag } from "../actions";
import { ConfirmButton } from "@/components/admin/ui";
import { IconPlus, IconSearch, IconExternal } from "@/components/icons";

export const metadata = { title: "Товары" };

const FILTERS = {
  all: { label: "Все", where: {} },
  live: { label: "На сайте", where: { published: true } },
  hidden: { label: "Скрытые", where: { published: false } },
  out: { label: "Нет в наличии", where: { inStock: false } },
} satisfies Record<string, { label: string; where: Prisma.ProductWhereInput }>;

export default async function AdminProducts({ searchParams }: {
  searchParams: Promise<{ q?: string; f?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) ?? "";
  const f = (sp.f && sp.f in FILTERS ? sp.f : "all") as keyof typeof FILTERS;

  const where: Prisma.ProductWhereInput = { ...FILTERS[f].where };
  if (q) {
    where.OR = (["title", "sku", "oem", "carMake", "carModel"] as const).map((k) => ({
      [k]: { contains: q, mode: "insensitive" as const },
    }));
  }

  const [products, counts] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        category: { select: { name: true } },
      },
    }),
    Promise.all(Object.values(FILTERS).map((x) => db.product.count({ where: x.where }))),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">Каталог</div>
          <h1 className="h-display mt-2 text-4xl sm:text-5xl">Товары</h1>
        </div>
        <Link href="/admin/products/new" className="btn btn-red">
          <IconPlus /> Добавить товар
        </Link>
      </div>

      {sp.saved && (
        <div className="animate-rise mt-6 border-l-2 border-ok bg-ok/10 px-4 py-3 text-sm">
          Сохранено: <b>{sp.saved}</b>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 border-b border-line sm:mt-8">
        <div className="-mx-4 flex gap-1 overflow-x-auto whitespace-nowrap px-4 sm:mx-0 sm:px-0">
          {Object.entries(FILTERS).map(([k, v], i) => (
            <Link
              key={k}
              href={`/admin?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`-mb-px border-b-2 px-3 py-3 font-display text-sm font-bold uppercase tracking-[0.08em] ${
                f === k ? "border-red text-bone" : "border-transparent text-smoke hover:text-ash"
              }`}
            >
              {v.label} <span className="ml-1 font-mono text-xs text-smoke">{counts[i]}</span>
            </Link>
          ))}
        </div>
        <form className="relative order-first w-full pb-3 sm:order-none sm:ml-auto sm:w-72">
          <input type="hidden" name="f" value={f} />
          <IconSearch className="pointer-events-none absolute left-3 top-[13px] text-smoke" width={16} />
          <input name="q" defaultValue={q} placeholder="Название, артикул, марка" className="field h-10 pl-9 text-sm" />
        </form>
      </div>

      {products.length === 0 ? (
        <div className="grid-bg mt-8 flex h-64 flex-col items-center justify-center border border-dashed border-line-strong text-center">
          <div className="h-display text-3xl text-ash">{q || f !== "all" ? "Ничего не найдено" : "Товаров пока нет"}</div>
          {!q && f === "all" && (
            <Link href="/admin/products/new" className="btn btn-red btn-sm mt-6">Добавить первый</Link>
          )}
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {products.map((p) => (
            <li key={p.id} className="group flex flex-wrap items-center gap-x-3 gap-y-3 py-4 sm:gap-4 lg:flex-nowrap">
              <Link href={`/admin/products/${p.id}`} className="h-14 w-16 shrink-0 overflow-hidden border border-line bg-steel sm:h-16 sm:w-20">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(p.images[0].file, "sm")} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-mono text-[10px] text-smoke">нет фото</div>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${p.id}`} className="block truncate font-display text-lg font-bold uppercase hover:text-red-hot">
                  {p.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-smoke">
                  {p.sku && <span>арт. {p.sku}</span>}
                  {p.carMake && <span>{[p.carMake, p.carModel].filter(Boolean).join(" ")}</span>}
                  {p.category && <span>{p.category.name}</span>}
                  <span>{conditionLabel(p)}</span>
                  <span>{p.views} просм.</span>
                </div>
              </div>

              <div className="shrink-0 text-right font-display text-lg font-bold lg:w-32">{priceLabel(p)}</div>

              <div className="flex shrink-0 gap-1 max-lg:basis-full">
                <Flag id={p.id} flag="published" on={p.published} labels={["На сайте", "Скрыт"]} />
                <Flag id={p.id} flag="inStock" on={p.inStock} labels={["В наличии", "Нет"]} />
                <Flag id={p.id} flag="featured" on={p.featured} labels={["★", "☆"]} title="Показывать первым на главной" />
              </div>

              <div className="flex shrink-0 gap-1 max-lg:basis-full max-lg:[&>*]:flex-1 max-lg:[&_.btn]:w-full">
                {p.published && (
                  <Link href={`/catalog/${p.slug}`} target="_blank" className="btn btn-ghost btn-sm px-3" title="Открыть на сайте">
                    <IconExternal width={14} />
                  </Link>
                )}
                <Link href={`/admin/products/${p.id}`} className="btn btn-ghost btn-sm">Изменить</Link>
                <form action={duplicateProduct}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn-ghost btn-sm" title="Создать копию (без фото, скрытую)">Копия</button>
                </form>
                <form action={deleteProduct}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton className="btn btn-ghost btn-sm w-24" confirm="Удалить!">Удалить</ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Flag({ id, flag, on, labels, title }: { id: string; flag: string; on: boolean; labels: [string, string]; title?: string }) {
  return (
    <form action={toggleProductFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <button
        title={title ?? "Переключить"}
        className={`h-9 min-w-9 border px-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          on ? "border-red/60 bg-red/15 text-bone hover:bg-red/25" : "border-line text-smoke hover:border-line-strong"
        }`}
      >
        {on ? labels[0] : labels[1]}
      </button>
    </form>
  );
}
