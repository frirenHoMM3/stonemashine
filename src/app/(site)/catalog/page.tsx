import Link from "next/link";
import type { Metadata } from "next";
import type { Condition, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CONDITIONS, CONDITION_LABEL } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { AutoSubmit } from "@/components/AutoSubmit";
import { IconSearch } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Каталог" };

const PER_PAGE = 24;
const SORTS = {
  new: { label: "Сначала новые", order: [{ createdAt: "desc" }] },
  cheap: { label: "Сначала дешевле", order: [{ price: { sort: "asc", nulls: "last" } }] },
  expensive: { label: "Сначала дороже", order: [{ price: { sort: "desc", nulls: "last" } }] },
} satisfies Record<string, { label: string; order: Prisma.ProductOrderByWithRelationInput[] }>;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || "";
const int = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : undefined);

export default async function Catalog({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 100);
  const cat = one(sp.cat);
  const make = one(sp.make);
  const model = one(sp.model);
  const cond = one(sp.cond) as Condition | "";
  const min = int(one(sp.min));
  const max = int(one(sp.max));
  const stock = one(sp.stock) === "1";
  const sort = (one(sp.sort) in SORTS ? one(sp.sort) : "new") as keyof typeof SORTS;
  const page = Math.max(1, int(one(sp.page)) ?? 1);

  const where: Prisma.ProductWhereInput = { published: true };
  if (q) {
    // Артикулы пишут и с дефисами, и без — ищем оба варианта
    const compact = q.replace(/[\s\-./]/g, "");
    const terms = [...new Set([q, compact].filter(Boolean))];
    where.OR = terms.flatMap((t) =>
      (["title", "sku", "oem", "brand", "carMake", "carModel", "description"] as const).map((f) => ({
        [f]: { contains: t, mode: "insensitive" as const },
      })),
    );
  }
  if (cat) where.category = { slug: cat };
  if (make) where.carMake = { equals: make, mode: "insensitive" };
  if (model) where.carModel = { equals: model, mode: "insensitive" };
  if (cond && CONDITIONS.includes(cond)) where.condition = cond;
  if (min != null || max != null) where.price = { gte: min, lte: max };
  if (stock) where.inStock = true;

  const [products, total, categories, makes, models] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [...SORTS[sort].order, { id: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        slug: true, title: true, price: true, oldPrice: true, condition: true, carMake: true,
        carModel: true, yearFrom: true, yearTo: true, sku: true, inStock: true,
        images: { select: { file: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    distinct("carMake", {}),
    make ? distinct("carModel", { carMake: { equals: make, mode: "insensitive" } }) : Promise.resolve([]),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = { q, cat, make, model, cond, min: one(sp.min), max: one(sp.max), stock: stock ? "1" : "", sort };
  const href = (patch: Partial<typeof current> & { page?: number }) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch })) {
      if (v && !(k === "sort" && v === "new") && !(k === "page" && v === 1)) u.set(k, String(v));
    }
    const s = u.toString();
    return `/catalog${s ? `?${s}` : ""}`;
  };
  const activeFilters = [cat, make, model, cond, min, max, stock].filter((v) => v !== "" && v != null && v !== false).length;
  const catName = categories.find((c) => c.slug === cat)?.name;

  return (
    <div className="wrap pt-10 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="label">Каталог</div>
          <h1 className="h-display mt-3 text-5xl md:text-7xl">{catName ?? (q ? `«${q}»` : "Все запчасти")}</h1>
        </div>
        <div className="font-mono text-sm text-ash">
          Найдено: <span className="text-bone">{total}</span>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* ——— ФИЛЬТРЫ ——— */}
        <aside>
          <input id="filters-toggle" type="checkbox" className="peer sr-only" defaultChecked={activeFilters > 0} />
          <label
            htmlFor="filters-toggle"
            className="flex h-12 cursor-pointer items-center justify-between border border-line px-4 font-display font-bold uppercase tracking-[0.08em] peer-checked:[&>span:last-child]:rotate-45 lg:hidden"
          >
            <span className="flex items-center gap-3">
              Фильтры {activeFilters > 0 && <span className="bg-red px-2 font-mono text-xs">{activeFilters}</span>}
            </span>
            <span className="text-xl transition-transform">+</span>
          </label>

            <form action="/catalog" className="mt-4 hidden space-y-6 peer-checked:block lg:sticky lg:top-24 lg:mt-0 lg:block">
              <AutoSubmit />
              <label className="relative block">
                <span className="label mb-2 block">Поиск</span>
                <IconSearch className="pointer-events-none absolute bottom-3 left-3 text-smoke" />
                <input name="q" defaultValue={q} placeholder="Артикул, название…" className="field pl-10" />
              </label>

              {categories.length > 0 && (
                <Select name="cat" label="Категория" value={cat} options={categories.map((c) => [c.slug, c.name])} />
              )}
              <Select name="make" label="Марка" value={make} options={makes.map((m) => [m, m])} />
              {make && models.length > 0 && (
                <Select name="model" label="Модель" value={model} options={models.map((m) => [m, m])} />
              )}
              <Select name="cond" label="Состояние" value={cond} options={CONDITIONS.map((c) => [c, CONDITION_LABEL[c]])} />

              <div>
                <span className="label mb-2 block">Цена, ₽</span>
                <div className="flex">
                  <input name="min" inputMode="numeric" defaultValue={current.min} placeholder="от" className="field" data-no-auto />
                  <input name="max" inputMode="numeric" defaultValue={current.max} placeholder="до" className="field -ml-px" data-no-auto />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" name="stock" value="1" defaultChecked={stock} className="peer sr-only" />
                <span className="flex h-5 w-5 items-center justify-center border border-line-strong peer-checked:border-red peer-checked:bg-red peer-checked:[&>svg]:opacity-100 peer-focus-visible:outline-2 peer-focus-visible:outline-red-hot">
                  <svg viewBox="0 0 12 10" className="h-2.5 w-3 text-white opacity-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 5l3.5 3.5L11 1" /></svg>
                </span>
                Только в наличии
              </label>

              <input type="hidden" name="sort" value={sort === "new" ? "" : sort} />
              <div className="flex gap-2">
                <button className="btn btn-red flex-1">Показать</button>
                {activeFilters + (q ? 1 : 0) > 0 && <Link href="/catalog" className="btn btn-ghost">Сброс</Link>}
              </div>
            </form>
        </aside>

        {/* ——— СПИСОК ——— */}
        <div>
          <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 font-display text-sm font-bold uppercase tracking-[0.08em]">
            {Object.entries(SORTS).map(([k, v]) => (
              <Link
                key={k}
                href={href({ sort: k as keyof typeof SORTS, page: 1 })}
                className={k === sort ? "text-bone underline decoration-red decoration-2 underline-offset-8" : "text-smoke hover:text-ash"}
              >
                {v.label}
              </Link>
            ))}
          </div>

          {products.length ? (
            <Reveal key={JSON.stringify(current) + page} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" step={45}>
              {products.map((p, i) => <ProductCard key={p.slug} p={p} index={i} />)}
            </Reveal>
          ) : (
            <div className="grid-bg flex h-72 flex-col items-center justify-center border border-dashed border-line-strong text-center">
              <div className="h-display text-3xl text-ash">Ничего не нашлось</div>
              <p className="mt-2 max-w-xs text-sm text-smoke">Попробуйте убрать часть фильтров или поискать по OEM-номеру.</p>
              <Link href="/catalog" className="btn btn-ghost btn-sm mt-6">Сбросить фильтры</Link>
            </div>
          )}

          {pages > 1 && (
            <nav className="mt-12 flex flex-wrap items-center gap-1 font-mono text-sm" aria-label="Страницы">
              {pageList(page, pages).map((p, i) =>
                p === 0 ? (
                  <span key={`gap${i}`} className="px-2 text-smoke">…</span>
                ) : (
                  <Link
                    key={p}
                    href={href({ page: p })}
                    aria-current={p === page ? "page" : undefined}
                    className={`flex h-10 min-w-10 items-center justify-center border px-3 ${
                      p === page ? "border-red bg-red text-white" : "border-line text-ash hover:border-line-strong hover:text-bone"
                    }`}
                  >
                    {p}
                  </Link>
                ),
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

async function distinct(field: "carMake" | "carModel", extra: Prisma.ProductWhereInput) {
  const rows = await db.product.findMany({
    where: { published: true, [field]: { not: null }, ...extra },
    distinct: [field],
    select: { [field]: true },
    orderBy: { [field]: "asc" },
  });
  return rows.map((r) => (r as unknown as Record<string, string>)[field]).filter(Boolean);
}

function pageList(cur: number, total: number) {
  const out: number[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - cur) <= 1) out.push(p);
    else if (out[out.length - 1] !== 0) out.push(0);
  }
  return out;
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      <select name={name} defaultValue={value} className="field">
        <option value="">Любая</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
