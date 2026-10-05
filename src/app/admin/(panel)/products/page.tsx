import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { conditionLabel, priceLabel } from "@/lib/format";
import { NEEDS_ATTENTION, problems } from "@/lib/admin-filters";
import { purgeExpiredTrash } from "../../actions";
import { ProductTable } from "@/components/admin/ProductTable";
import { Dropdown } from "@/components/Dropdown";
import { AutoSubmit } from "@/components/AutoSubmit";
import { IconPlus, IconSearch } from "@/components/icons";

export const metadata = { title: "Товары" };

const PER_PAGE = 50;

const TABS = {
  all: { label: "Все", where: { deletedAt: null } },
  live: { label: "На сайте", where: { deletedAt: null, published: true } },
  hidden: { label: "Скрытые", where: { deletedAt: null, published: false } },
  out: { label: "Нет в наличии", where: { deletedAt: null, inStock: false } },
  attention: { label: "Требуют внимания", where: NEEDS_ATTENTION },
  trash: { label: "Корзина", where: { deletedAt: { not: null } } },
} satisfies Record<string, { label: string; where: Prisma.ProductWhereInput }>;

const SORTS = {
  updated: { label: "Недавно изменённые", order: { updatedAt: "desc" } },
  created: { label: "Недавно добавленные", order: { createdAt: "desc" } },
  views: { label: "Популярные", order: { views: "desc" } },
  expensive: { label: "Дороже", order: { price: { sort: "desc", nulls: "last" } } },
  cheap: { label: "Дешевле", order: { price: { sort: "asc", nulls: "last" } } },
  title: { label: "По названию", order: { title: "asc" } },
} satisfies Record<string, { label: string; order: Prisma.ProductOrderByWithRelationInput }>;

type SP = { q?: string; f?: string; sort?: string; page?: string; saved?: string; cat?: string };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) ?? "";
  const tab = (sp.f && sp.f in TABS ? sp.f : "all") as keyof typeof TABS;
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : "updated") as keyof typeof SORTS;
  const page = Math.max(1, Number(sp.page) || 1);

  if (tab === "trash") await purgeExpiredTrash();

  const where: Prisma.ProductWhereInput = { AND: [TABS[tab].where] };
  const and = where.AND as Prisma.ProductWhereInput[];
  if (q) {
    and.push({
      OR: (["title", "sku", "oem", "carMake", "carModel", "brand"] as const).map((k) => ({
        [k]: { contains: q, mode: "insensitive" as const },
      })),
    });
  }
  if (sp.cat) and.push(sp.cat === "none" ? { categoryId: null } : { categoryId: sp.cat });

  const [rows, total, counts, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [SORTS[sort].order, { id: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        category: { select: { name: true } },
      },
    }),
    db.product.count({ where }),
    Promise.all(Object.values(TABS).map((x) => db.product.count({ where: x.where }))),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const link = (patch: Partial<SP>) => {
    const u = new URLSearchParams();
    const next = { q, f: tab, sort, cat: sp.cat, ...patch };
    if (next.q) u.set("q", next.q);
    if (next.f && next.f !== "all") u.set("f", next.f);
    if (next.sort && next.sort !== "updated") u.set("sort", next.sort);
    if (next.cat) u.set("cat", next.cat);
    if (patch.page && patch.page !== "1") u.set("page", patch.page);
    const s = u.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="h-display text-4xl sm:text-5xl">Товары</h1>
        <Link href="/admin/products/new" className="btn btn-red">
          <IconPlus /> Добавить товар
        </Link>
      </div>

      {sp.saved && (
        <div className="animate-rise mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-l-2 border-ok bg-ok/10 px-4 py-3 text-sm">
          <span>✓ Сохранено: <b>{sp.saved}</b></span>
          <Link href="/admin/products/new" className="font-mono text-xs uppercase tracking-wider text-ok hover:underline">+ добавить ещё</Link>
        </div>
      )}

      {/* Вкладки */}
      <div className="no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-line px-4 sm:mx-0 sm:px-0">
        {Object.entries(TABS).map(([k, v], i) => (
          <Link
            key={k}
            href={link({ f: k })}
            className={`-mb-px border-b-2 px-3 py-3 font-display text-sm font-bold uppercase tracking-[0.08em] ${
              tab === k ? "border-red text-bone" : "border-transparent text-smoke hover:text-ash"
            }`}
          >
            {v.label}
            <span className={`ml-1.5 font-mono text-xs ${k === "attention" && counts[i] ? "text-red-hot" : "text-smoke"}`}>{counts[i]}</span>
          </Link>
        ))}
      </div>

      {/* Поиск, категория, сортировка */}
      <form className="mt-4 flex flex-wrap gap-2">
        {tab !== "all" && <input type="hidden" name="f" value={tab} />}
        <label className="relative min-w-0 flex-1 basis-60">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-smoke" width={16} />
          <input name="q" defaultValue={q} placeholder="Поиск: название, артикул, OEM, марка" className="field h-10 pl-9 text-sm" />
        </label>
        <AutoSubmit />
        <Dropdown
          name="cat"
          defaultValue={sp.cat ?? ""}
          size="sm"
          className="w-full sm:w-48 [&_.field]:h-10"
          ariaLabel="Категория"
          options={[
            { value: "", label: "Все категории" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
            { value: "none", label: "Без категории" },
          ]}
        />
        <Dropdown
          name="sort"
          defaultValue={sort}
          size="sm"
          className="w-full sm:w-52 [&_.field]:h-10"
          ariaLabel="Сортировка"
          options={Object.entries(SORTS).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <button className="btn btn-ghost btn-sm h-10 max-sm:hidden">Найти</button>
      </form>

      {tab === "trash" && rows.length > 0 && (
        <p className="mt-4 text-sm text-ash">Товары в корзине не видны на сайте. Через 30 дней удаляются насовсем вместе с фото.</p>
      )}

      {rows.length === 0 ? (
        <div className="grid-bg mt-6 flex h-56 flex-col items-center justify-center border border-dashed border-line-strong px-4 text-center">
          <div className="h-display text-3xl text-ash">
            {q || sp.cat ? "Ничего не найдено" : tab === "trash" ? "Корзина пуста" : tab === "attention" ? "Всё заполнено 👌" : "Здесь пока пусто"}
          </div>
          {tab === "all" && !q && !sp.cat && (
            <Link href="/admin/products/new" className="btn btn-red btn-sm mt-6">Добавить первый товар</Link>
          )}
        </div>
      ) : (
        <ProductTable
          trash={tab === "trash"}
          categories={categories}
          rows={rows.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            thumb: p.images[0]?.file ?? null,
            price: priceLabel(p),
            meta: [p.sku && `арт. ${p.sku}`, [p.carMake, p.carModel].filter(Boolean).join(" "), p.category?.name, conditionLabel(p)].filter(Boolean) as string[],
            views: p.views,
            published: p.published,
            inStock: p.inStock,
            featured: p.featured,
            problems: problems(p),
            deletedAt: p.deletedAt?.toISOString() ?? null,
          }))}
        />
      )}

      {pages > 1 && (
        <nav className="mt-8 flex flex-wrap items-center gap-1 font-mono text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={link({ page: String(n) })}
              className={`flex h-9 min-w-9 items-center justify-center border px-2 ${n === page ? "border-red bg-red text-white" : "border-line text-ash hover:text-bone"}`}
            >
              {n}
            </Link>
          ))}
          <span className="ml-3 text-xs text-smoke">всего {total}</span>
        </nav>
      )}
    </div>
  );
}
