import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { priceLabel } from "@/lib/format";
import { mediaUrl } from "@/lib/uploads-url";
import { NEEDS_ATTENTION, problems } from "@/lib/admin-filters";
import { IconArrow, IconExternal, IconPlus } from "@/components/icons";

export const metadata = { title: "Сводка" };

export default async function Dashboard() {
  const live = { deletedAt: null };
  const [s, total, published, outOfStock, views, attentionCount, attention, popular, recent, categories] = await Promise.all([
    getSettings(),
    db.product.count({ where: live }),
    db.product.count({ where: { ...live, published: true } }),
    db.product.count({ where: { ...live, inStock: false } }),
    db.product.aggregate({ where: live, _sum: { views: true } }),
    db.product.count({ where: NEEDS_ATTENTION }),
    db.product.findMany({ where: NEEDS_ATTENTION, orderBy: { updatedAt: "desc" }, take: 6, include: { images: { take: 1 } } }),
    db.product.findMany({ where: { ...live, views: { gt: 0 } }, orderBy: { views: "desc" }, take: 5, select: { id: true, title: true, views: true } }),
    db.product.findMany({ where: live, orderBy: { updatedAt: "desc" }, take: 5, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } }),
    db.category.count(),
  ]);

  // Пустой магазин — показываем пошаговый старт вместо пустых цифр
  if (total === 0) {
    const steps = [
      { done: !!(s.phone || s.telegram || s.avitoProfile), title: "Заполните контакты", text: "Телефон, Telegram, ссылка на профиль Авито — появятся на сайте.", href: "/admin/settings", cta: "Открыть настройки" },
      { done: categories > 0, title: "Создайте категории", text: "Необязательно. Например: Двигатель, Кузов, Оптика.", href: "/admin/categories", cta: "К категориям" },
      { done: false, title: "Добавьте первый товар", text: "Фото, название, цена и ссылка на объявление — этого достаточно.", href: "/admin/products/new", cta: "Добавить товар" },
    ];
    return (
      <div className="max-w-2xl">
        <h1 className="h-display text-4xl sm:text-5xl">Начнём</h1>
        <p className="mt-2 text-ash">Три шага — и магазин готов.</p>
        <ol className="mt-8 space-y-3">
          {steps.map((st, i) => (
            <li key={i} className={`flex gap-4 border p-5 ${st.done ? "border-ok/40" : "border-line bg-coal"}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center font-display text-lg font-bold ${st.done ? "bg-ok text-ink" : "bg-red"}`}>
                {st.done ? "✓" : i + 1}
              </span>
              <div className="flex-1">
                <div className="font-display text-xl font-bold uppercase">{st.title}</div>
                <p className="mt-1 text-sm text-ash">{st.text}</p>
                {!st.done && <Link href={st.href} className="btn btn-ghost btn-sm mt-3">{st.cta} <IconArrow width={14} /></Link>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const tiles = [
    { n: published, label: "на сайте", href: "/admin/products?f=live" },
    { n: total - published, label: "скрыто", href: "/admin/products?f=hidden" },
    { n: outOfStock, label: "нет в наличии", href: "/admin/products?f=out" },
    { n: views._sum.views ?? 0, label: "просмотров", href: "/admin/products?sort=views" },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="h-display text-4xl sm:text-5xl">Сводка</h1>
        <div className="flex gap-2">
          <Link href="/" target="_blank" className="btn btn-ghost">Сайт <IconExternal width={15} /></Link>
          <Link href="/admin/products/new" className="btn btn-red"><IconPlus /> Добавить товар</Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group bg-ink p-5 transition-colors hover:bg-coal">
            <div className="font-display text-4xl font-bold tabular-nums sm:text-5xl">{t.n.toLocaleString("ru-RU")}</div>
            <div className="label mt-1 group-hover:text-bone">{t.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <Head title="Требуют внимания" count={attentionCount} href="/admin/products?f=attention" />
          {attention.length ? (
            <ul className="divide-y divide-line border-y border-line">
              {attention.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-coal">
                    <Thumb file={p.images[0]?.file} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base font-bold uppercase">{p.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {problems(p).map((x) => (
                          <span key={x} className="border border-red/40 px-1.5 font-mono text-[10px] uppercase tracking-wider text-red-hot">{x}</span>
                        ))}
                      </div>
                    </div>
                    <span className="pr-2 font-mono text-xs text-smoke">заполнить →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border border-ok/30 bg-ok/5 p-5 text-sm text-ash">Все карточки заполнены: у каждой есть фото, цена и ссылка.</div>
          )}
        </section>

        <div className="min-w-0 space-y-10">
          <section>
            <Head title="Недавно изменённые" href="/admin/products" />
            <ul className="divide-y divide-line border-y border-line">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-coal">
                    <Thumb file={p.images[0]?.file} small />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    <span className="font-display font-bold">{priceLabel(p)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {popular.length > 0 && (
            <section>
              <Head title="Смотрят чаще всего" href="/admin/products?sort=views" />
              <ol className="space-y-2">
                {popular.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-mono text-red">{i + 1}</span>
                    <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1 truncate hover:text-red-hot">{p.title}</Link>
                    <span className="font-mono text-xs text-smoke">{p.views}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Head({ title, count, href }: { title: string; count?: number; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-xl font-bold uppercase">
        {title} {count != null && count > 0 && <span className="ml-1 bg-red px-1.5 font-mono text-sm">{count}</span>}
      </h2>
      <Link href={href} className="font-mono text-xs uppercase tracking-wider text-smoke hover:text-bone">все →</Link>
    </div>
  );
}

function Thumb({ file, small }: { file?: string; small?: boolean }) {
  const size = small ? "h-9 w-12" : "h-12 w-16";
  return file ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(file, "sm")} alt="" className={`${size} shrink-0 border border-line object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center border border-dashed border-red/40 font-mono text-[9px] text-red-hot`}>нет фото</div>
  );
}
