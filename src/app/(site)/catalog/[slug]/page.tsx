import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { conditionLabel, formatPrice, formatYears, parseSections, parseSpecs, priceLabel } from "@/lib/format";
import { mediaUrl } from "@/lib/uploads-url";
import { abs } from "@/lib/site";
import { Gallery } from "@/components/Gallery";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { JsonLd } from "@/components/JsonLd";
import { CopyButton } from "@/components/CopyButton";
import { RichText } from "@/components/RichText";
import { IconExternal, IconPhone, IconTelegram } from "@/components/icons";

export const dynamic = "force-dynamic";

const getProduct = cache((slug: string) =>
  db.product.findFirst({
    where: { slug, published: true },
    include: { images: { orderBy: { sortOrder: "asc" } }, category: true },
  }),
);

const SCHEMA_CONDITION = {
  NEW: "https://schema.org/NewCondition",
  USED: "https://schema.org/UsedCondition",
  CONTRACT: "https://schema.org/UsedCondition",
  REFURBISHED: "https://schema.org/RefurbishedCondition",
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return { robots: { index: false } };
  const car = [p.carMake, p.carModel, formatYears(p.yearFrom, p.yearTo)].filter(Boolean).join(" ");
  const title = [p.title, car].filter(Boolean).join(" — ");
  const desc = [
    `${conditionLabel(p)}, ${p.inStock ? "в наличии" : "нет в наличии"}`,
    [priceLabel(p), p.price != null && p.priceNote].filter(Boolean).join(" "),
    p.oem && `OEM ${p.oem}`,
    p.sku && `арт. ${p.sku}`,
    p.description?.slice(0, 100),
  ].filter(Boolean).join(". ");
  const url = `/catalog/${p.slug}`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      images: p.images.slice(0, 3).map((i) => ({ url: mediaUrl(i.file, "lg"), width: i.width, height: i.height })),
    },
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
      slug: true, title: true, price: true, oldPrice: true, priceNote: true, condition: true, conditionNote: true,
      carMake: true, carModel: true, yearFrom: true, yearTo: true, sku: true, inStock: true,
      images: { select: { file: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  const specs = parseSpecs(p.specs);
  const sections = parseSections(p.sections);
  const years = formatYears(p.yearFrom, p.yearTo);
  const car = [p.carMake, p.carModel].filter(Boolean).join(" ");
  const discount = p.oldPrice && p.price && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const tel = s.phone.replace(/[^\d+]/g, "");
  const url = abs(`/catalog/${p.slug}`);

  const codes = [
    ["OEM", p.oem],
    ["Артикул", p.sku],
  ].filter((f): f is [string, string] => !!f[1]);
  const facts = [
    ["Применимость", [car, years].filter(Boolean).join(", ")],
    ["Производитель", p.brand],
    ["Категория", p.category?.name],
  ].filter((f): f is [string, string] => !!f[1]);

  const buyHost = p.avitoUrl ? new URL(p.avitoUrl).hostname.replace(/^(www|m)\./, "") : null;
  const buyText = buyHost?.endsWith("avito.ru") ? "Купить на Авито" : "Купить";
  const buy = p.avitoUrl && (
    <a
      href={p.avitoUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="btn btn-red group h-14 w-full text-base"
    >
      <span className="absolute inset-0 -translate-x-full bg-red-hot transition-transform duration-500 ease-out-hard group-hover:translate-x-0" />
      <span className="relative flex items-center gap-3">{buyText} <IconExternal /></span>
    </a>
  );

  return (
    <div className="wrap pt-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          url,
          image: p.images.map((i) => abs(mediaUrl(i.file, "lg"))),
          ...(p.description && { description: p.description }),
          ...(p.sku && { sku: p.sku }),
          ...(p.oem && { mpn: p.oem }),
          ...(p.brand && { brand: { "@type": "Brand", name: p.brand } }),
          ...(p.category && { category: p.category.name }),
          ...(p.price != null && {
            offers: {
              "@type": "Offer",
              url,
              price: p.price,
              priceCurrency: "RUB",
              availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              itemCondition: SCHEMA_CONDITION[p.condition],
              seller: { "@type": "Organization", name: s.shopName },
            },
          }),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { name: "Каталог", item: abs("/catalog") },
            ...(p.category ? [{ name: p.category.name, item: abs(`/catalog?cat=${p.category.slug}`) }] : []),
            { name: p.title, item: url },
          ].map((x, i) => ({ "@type": "ListItem", position: i + 1, ...x })),
        }}
      />

      <nav className="label flex items-center gap-2 overflow-hidden whitespace-nowrap" aria-label="Хлебные крошки">
        <Link href="/catalog" className="hover:text-bone">Каталог</Link>
        {p.category && (
          <>
            <span className="text-red">/</span>
            <Link href={`/catalog?cat=${p.category.slug}`} className="hover:text-bone">{p.category.name}</Link>
          </>
        )}
      </nav>

      <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <div className="animate-rise">
          <Gallery images={p.images} title={p.title} />
        </div>

        <div className="animate-rise [animation-delay:100ms]">
          <h1 className="h-display text-[2rem] sm:text-4xl md:text-[3.2rem]">{p.title}</h1>
          {car && (
            <div className="mt-2 font-mono text-sm text-ash">
              {car} {years && <span className="text-smoke">· {years}</span>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="border border-line-strong px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em]">
              {conditionLabel(p)}
            </span>
            <span className={`flex items-center gap-2 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${p.inStock ? "border-ok/40 text-ok" : "border-line text-smoke"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${p.inStock ? "animate-pulse bg-ok" : "bg-smoke"}`} />
              {p.inStock ? "В наличии" : "Нет в наличии"}
            </span>
          </div>

          <div className="notch mt-5 bg-coal p-5 sm:p-6">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <div className={`font-display font-bold leading-none tracking-tight ${p.price == null ? "text-3xl sm:text-4xl" : "text-[2.6rem] sm:text-5xl"}`}>{priceLabel(p)}</div>
              {p.price != null && p.priceNote && <div className="mb-1 font-mono text-sm text-ash">{p.priceNote}</div>}
              {discount > 0 && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-sm text-smoke line-through">{formatPrice(p.oldPrice)}</span>
                  <span className="bg-red px-1.5 font-mono text-xs">−{discount}%</span>
                </div>
              )}
            </div>
            {buy && <div className="mt-5 hidden lg:block">{buy}</div>}
            {(tel || s.telegram) && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {tel && (
                  <a href={`tel:${tel}`} className="btn btn-ghost btn-sm">
                    <IconPhone width={15} /> Позвонить
                  </a>
                )}
                {s.telegram && (
                  <a href={`https://t.me/${s.telegram}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    <IconTelegram width={15} /> Спросить
                  </a>
                )}
              </div>
            )}
            {buyHost?.endsWith("avito.ru") && (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-smoke">Оплата и доставка — через Авито</p>
            )}
          </div>

          {codes.length > 0 && (
            <dl className="mt-5 grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
              {codes.map(([k, v]) => (
                <div key={k} className="bg-ink p-3">
                  <dt className="label flex justify-between">{k} <CopyButton value={v} /></dt>
                  <dd className="mt-1 select-all break-all font-mono text-[15px]">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {(facts.length > 0 || specs.length > 0) && (
            <dl className="mt-5 border-t border-line">
              {[...facts, ...specs.map((x) => [x.k, x.v] as [string, string])].map(([k, v], i) =>
                k && v ? (
                  <div key={i} className="grid grid-cols-[minmax(110px,40%)_1fr] gap-4 border-b border-line py-2.5 text-sm">
                    <dt className="text-ash">{k}</dt>
                    <dd className="whitespace-pre-line break-words">{v}</dd>
                  </div>
                ) : (
                  // Строка без пары «параметр — значение»: выводим как есть, во всю ширину
                  <div key={i} className="whitespace-pre-line break-words border-b border-line py-2.5 text-sm">{k || v}</div>
                ),
              )}
            </dl>
          )}

          {p.description && <RichText text={p.description} className="mt-6" />}

          {sections.map((sec, i) => (
            <section key={i} className="mt-8">
              {sec.t && <h2 className="h-display border-b border-line pb-2 text-2xl">{sec.t}</h2>}
              {sec.b && <RichText text={sec.b} className="mt-3" />}
            </section>
          ))}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16 lg:mt-24">
          <h2 className="h-display border-b border-line pb-3 text-3xl md:text-4xl">Похожие позиции</h2>
          <Reveal className="mt-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {similar.map((x, i) => <ProductCard key={x.slug} p={x} index={i} />)}
          </Reveal>
        </section>
      )}

      {/* Мобильная панель покупки: цена и кнопка всегда под пальцем */}
      {(p.avitoUrl || tel) && (
      <div data-buybar className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl font-bold leading-tight">{priceLabel(p)}</div>
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-smoke">{p.inStock ? "В наличии" : "Нет в наличии"}</div>
        </div>
        {p.avitoUrl ? (
          <a href={p.avitoUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-red h-12 shrink-0 px-5">
            {buyHost?.endsWith("avito.ru") ? "На Авито" : "Купить"} <IconExternal width={16} />
          </a>
        ) : (
          <a href={`tel:${tel}`} className="btn btn-red h-12 shrink-0 px-5">
            <IconPhone width={16} /> Позвонить
          </a>
        )}
      </div>
      )}
    </div>
  );
}
