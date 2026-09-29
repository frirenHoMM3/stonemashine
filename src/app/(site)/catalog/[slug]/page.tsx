import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CONDITION_LABEL, formatPrice, formatYears, parseSpecs } from "@/lib/format";
import { mediaUrl } from "@/lib/uploads-url";
import { Gallery } from "@/components/Gallery";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { IconExternal, IconPhone, IconTelegram } from "@/components/icons";

export const dynamic = "force-dynamic";

const getProduct = cache((slug: string) =>
  db.product.findFirst({
    where: { slug, published: true },
    include: { images: { orderBy: { sortOrder: "asc" } }, category: true },
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const desc = [p.carMake, p.carModel, p.sku && `арт. ${p.sku}`, formatPrice(p.price)].filter(Boolean).join(" · ");
  return {
    title: p.title,
    description: desc,
    openGraph: { title: p.title, description: desc, images: p.images[0] ? [mediaUrl(p.images[0].file, "lg")] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, s] = await Promise.all([getProduct(slug), getSettings()]);
  if (!p) notFound();

  db.product.update({ where: { id: p.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const similar = await db.product.findMany({
    where: {
      published: true,
      id: { not: p.id },
      OR: [
        ...(p.categoryId ? [{ categoryId: p.categoryId }] : []),
        ...(p.carMake ? [{ carMake: p.carMake }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      slug: true, title: true, price: true, oldPrice: true, condition: true, carMake: true,
      carModel: true, yearFrom: true, yearTo: true, sku: true, inStock: true,
      images: { select: { file: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  const specs = parseSpecs(p.specs);
  const years = formatYears(p.yearFrom, p.yearTo);
  const facts = [
    ["Марка", p.carMake],
    ["Модель", p.carModel],
    ["Годы", years],
    ["Производитель", p.brand],
    ["Артикул", p.sku],
    ["OEM", p.oem],
    ["Состояние", CONDITION_LABEL[p.condition]],
  ].filter((f): f is [string, string] => !!f[1]);
  const discount = p.oldPrice && p.price && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  return (
    <div className="wrap pt-8">
      <nav className="label flex flex-wrap items-center gap-2" aria-label="Хлебные крошки">
        <Link href="/catalog" className="hover:text-bone">Каталог</Link>
        {p.category && (
          <>
            <span className="text-red">/</span>
            <Link href={`/catalog?cat=${p.category.slug}`} className="hover:text-bone">{p.category.name}</Link>
          </>
        )}
        <span className="text-red">/</span>
        <span className="truncate text-smoke">{p.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <div className="animate-rise">
          <Gallery images={p.images} title={p.title} />
        </div>

        <div className="animate-rise [animation-delay:100ms]">
          <div className="flex flex-wrap gap-2">
            <span className="border border-line-strong px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em]">
              {CONDITION_LABEL[p.condition]}
            </span>
            <span className={`flex items-center gap-2 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${p.inStock ? "border-ok/40 text-ok" : "border-line text-smoke"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${p.inStock ? "animate-pulse bg-ok" : "bg-smoke"}`} />
              {p.inStock ? "В наличии" : "Нет в наличии"}
            </span>
          </div>

          <h1 className="h-display mt-5 text-4xl md:text-[3.4rem]">{p.title}</h1>
          {(p.carMake || years) && (
            <div className="mt-3 font-mono text-sm text-ash">
              {[p.carMake, p.carModel].filter(Boolean).join(" ")} {years && <span className="text-smoke">· {years}</span>}
            </div>
          )}

          <div className="notch mt-8 bg-coal p-6">
            <div className="flex items-end gap-4">
              <div className="font-display text-5xl font-bold tracking-tight">{formatPrice(p.price)}</div>
              {discount > 0 && (
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono text-sm text-smoke line-through">{formatPrice(p.oldPrice)}</span>
                  <span className="bg-red px-1.5 font-mono text-xs">−{discount}%</span>
                </div>
              )}
            </div>
            <a
              href={p.avitoUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-red group mt-6 h-14 w-full text-base"
            >
              <span className="absolute inset-0 -translate-x-full bg-red-hot transition-transform duration-500 ease-out-hard group-hover:translate-x-0" />
              <span className="relative flex items-center gap-3">Купить на Авито <IconExternal /></span>
            </a>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {s.phone && (
                <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="btn btn-ghost btn-sm">
                  <IconPhone width={15} /> Позвонить
                </a>
              )}
              {s.telegram && (
                <a href={`https://t.me/${s.telegram}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  <IconTelegram width={15} /> Спросить
                </a>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-smoke">
              Оплата и доставка оформляются на Авито. Перед покупкой можем сверить совместимость по VIN.
            </p>
          </div>

          {facts.length > 0 && (
            <dl className="mt-8 border-t border-line">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[140px_1fr] gap-4 border-b border-line py-3 text-sm">
                  <dt className="text-ash">{k}</dt>
                  <dd className={k === "Артикул" || k === "OEM" ? "select-all font-mono" : ""}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {(p.description || specs.length > 0) && (
        <div className="mt-20 grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
          {p.description && (
            <section>
              <h2 className="h-display border-b border-line pb-4 text-3xl">Описание</h2>
              <div className="mt-6 whitespace-pre-line leading-relaxed text-bone/85">{p.description}</div>
            </section>
          )}
          {specs.length > 0 && (
            <section>
              <h2 className="h-display border-b border-line pb-4 text-3xl">Характеристики</h2>
              <dl className="mt-2">
                {specs.map((sp, i) => (
                  <div key={i} className="flex items-baseline gap-3 py-2.5 text-sm">
                    <dt className="shrink-0 text-ash">{sp.k}</dt>
                    <span className="flex-1 translate-y-[-3px] border-b border-dotted border-line-strong" />
                    <dd className="text-right">{sp.v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}

      {similar.length > 0 && (
        <section className="mt-24">
          <h2 className="h-display border-b border-line pb-4 text-4xl">Похожие позиции</h2>
          <Reveal className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((x, i) => <ProductCard key={x.slug} p={x} index={i} />)}
          </Reveal>
        </section>
      )}
    </div>
  );
}
