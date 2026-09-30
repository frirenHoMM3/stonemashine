import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { IconArrow, IconExternal, IconSearch, IconPhone, IconTelegram } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

const cardSelect = {
  slug: true, title: true, price: true, oldPrice: true, priceNote: true, condition: true, conditionNote: true, carMake: true,
  carModel: true, yearFrom: true, yearTo: true, sku: true, inStock: true,
  images: { select: { file: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
};

export default async function Home() {
  const [s, products, categories, total, makes] = await Promise.all([
    getSettings(),
    db.product.findMany({
      where: { published: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: cardSelect,
    }),
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where: { published: true } } } } },
    }),
    db.product.count({ where: { published: true, inStock: true } }),
    db.product.findMany({
      where: { published: true, carMake: { not: null } },
      distinct: ["carMake"],
      select: { carMake: true },
      orderBy: { carMake: "asc" },
    }),
  ]);

  const words = s.tagline.trim().split(/\s+/);
  const tail = words.length > 1 ? words.pop() : null;
  const ticker = (categories.length ? categories.map((c) => c.name) : makes.map((m) => m.carMake!)).slice(0, 14);

  return (
    <>
      {/* ——— HERO ——— */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_20%,black,transparent_70%)]" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 bottom-[-0.18em] select-none font-display text-[34vw] font-extrabold uppercase leading-none text-transparent md:text-[22vw]"
          style={{ WebkitTextStroke: "1px rgb(255 255 255 / 0.05)" }}
        >
          {s.shopName.slice(0, 5)}
        </div>

        <div className="wrap relative pb-12 pt-10 md:pb-24 md:pt-24">
          <div className="label animate-rise flex items-center gap-3">
            <span className="h-[2px] w-10 origin-left animate-sweep bg-red" />
            Автозапчасти в наличии
          </div>

          <h1 className="h-display animate-rise mt-5 max-w-[14ch] text-[clamp(2.9rem,9.5vw,8.5rem)] [animation-delay:80ms]">
            {words.join(" ")} {tail && <span className="text-red">{tail}</span>}
          </h1>

          <form action="/catalog" className="animate-rise mt-8 flex max-w-2xl [animation-delay:160ms] md:mt-10">
            <label className="relative flex-1">
              <span className="sr-only">Поиск</span>
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke" />
              <input
                name="q"
                placeholder="Артикул, OEM или название"
                className="h-14 w-full min-w-0 border border-line-strong border-r-0 bg-coal/80 pl-12 pr-3 text-base backdrop-blur placeholder:text-smoke focus:border-red focus:outline-none"
              />
            </label>
            <button className="btn btn-red h-14 px-5 sm:px-7" aria-label="Найти"><IconSearch className="sm:hidden" /><span className="max-sm:hidden">Найти</span></button>
          </form>

          {makes.length > 0 && (
            <div className="animate-rise mt-4 flex max-w-2xl flex-wrap gap-1.5 [animation-delay:220ms]">
              {makes.slice(0, 12).map((m) => (
                <Link
                  key={m.carMake}
                  href={`/catalog?make=${encodeURIComponent(m.carMake!)}`}
                  className="border border-line px-3 py-1.5 font-mono text-xs text-ash transition-colors hover:border-red hover:text-bone"
                >
                  {m.carMake}
                </Link>
              ))}
            </div>
          )}

          <div className="animate-rise mt-6 flex flex-wrap gap-2 [animation-delay:260ms] sm:gap-3">
            <Link href="/catalog" className="btn btn-ghost group">
              Весь каталог <IconArrow className="transition-transform group-hover:translate-x-1" />
            </Link>
            {s.avitoProfile && (
              <a href={s.avitoProfile} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                Мы на Авито <IconExternal />
              </a>
            )}
          </div>

          <dl className="animate-rise mt-10 grid max-w-2xl grid-cols-3 border-t border-line [animation-delay:320ms] md:mt-16">
            {[
              [total, "в наличии"],
              [makes.length, "марок"],
              [categories.length, "категорий"],
            ].map(([n, l], i) => (
              <div key={i} className={`flex flex-col-reverse justify-end gap-1 pt-4 ${i ? "border-l border-line pl-4 sm:pl-5" : ""}`}>
                <dt className="label">{l}</dt>
                <dd className="font-display text-3xl font-bold tabular-nums sm:text-4xl md:text-5xl">
                  {String(n).padStart(2, "0")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ——— БЕГУЩАЯ СТРОКА ——— */}
      {ticker.length > 0 && (
        <div className="overflow-hidden border-b border-line bg-red py-3 text-ink">
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0" aria-hidden={k === 1}>
                {Array.from({ length: Math.ceil(12 / ticker.length) }).flatMap((_, r) =>
                  ticker.map((t, i) => (
                    <span key={`${r}-${i}`} className="flex items-center font-display text-xl font-extrabold uppercase tracking-[0.06em]">
                      <span className="px-6">{t}</span>
                      <span className="h-2 w-2 rotate-45 bg-ink" />
                    </span>
                  )),
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ——— ПОСТУПЛЕНИЯ ——— */}
      <section className="wrap pt-14 md:pt-24">
        <SectionHead n="01" title="Новые поступления" href="/catalog" link="Весь каталог" />
        {products.length ? (
          <Reveal className="mt-6 grid grid-cols-2 gap-2 sm:gap-4 md:mt-10 lg:grid-cols-4">
            {products.map((p, i) => <ProductCard key={p.slug} p={p} index={i} />)}
          </Reveal>
        ) : (
          <EmptyShelf />
        )}
      </section>

      {/* ——— КАТЕГОРИИ ——— */}
      {categories.length > 0 && (
        <section className="wrap pt-16 md:pt-28">
          <SectionHead n="02" title="Категории" />
          <Reveal className="mt-6 grid grid-cols-2 border-l border-t border-line md:mt-10 lg:grid-cols-3">
            {categories.map((c, i) => (
              <Link
                key={c.id}
                data-reveal
                href={`/catalog?cat=${c.slug}`}
                className="group relative flex h-28 flex-col justify-between overflow-hidden border-b border-r border-line p-4 transition-colors duration-300 hover:bg-red sm:h-36 sm:p-6"
              >
                <div className="flex justify-between font-mono text-xs text-smoke transition-colors group-hover:text-ink/70">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span>{c._count.products} шт.</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="font-display text-xl font-extrabold uppercase leading-none transition-colors group-hover:text-ink sm:text-3xl">
                    {c.name}
                  </span>
                  <IconArrow className="hidden -translate-x-3 opacity-0 sm:block transition-all duration-300 group-hover:translate-x-0 group-hover:text-ink group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      {/* ——— О НАС / КОНТАКТЫ ——— */}
      <section id="about" className="wrap scroll-mt-24 pt-16 md:pt-28">
        <div id="contacts" className="grid scroll-mt-24 gap-8 border border-line p-5 sm:p-7 md:grid-cols-[1.3fr_1fr] md:gap-10 md:p-12">
          <Reveal>
            <div className="label" data-reveal>О нас</div>
            <h2 className="h-display mt-3 text-4xl md:text-6xl" data-reveal>{s.shopName}</h2>
            <p className="mt-4 max-w-xl whitespace-pre-line leading-relaxed text-ash md:mt-6" data-reveal>
              {s.about || s.tagline}
            </p>
          </Reveal>
          <div className="flex flex-col gap-3 md:border-l md:border-line md:pl-10">
            <div className="label mb-2">Связаться</div>
            {s.phone && (
              <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="btn btn-red justify-start">
                <IconPhone /> {s.phone}
              </a>
            )}
            {s.telegram && (
              <a href={`https://t.me/${s.telegram}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost justify-start">
                <IconTelegram /> Telegram
              </a>
            )}
            {s.whatsapp && (
              <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost justify-start">
                <IconPhone /> WhatsApp
              </a>
            )}
            {s.avitoProfile && (
              <a href={s.avitoProfile} target="_blank" rel="noopener noreferrer" className="btn btn-ghost justify-start">
                <IconExternal /> Авито
              </a>
            )}
            {(s.address || s.hours) && (
              <div className="mt-4 space-y-1 font-mono text-sm text-ash">
                {s.address && <div>{s.address}</div>}
                {s.hours && <div>{s.hours}</div>}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHead({ n, title, href, link }: { n: string; title: string; href?: string; link?: string }) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-line pb-3 md:pb-5">
      <h2 className="h-display flex items-baseline gap-3 text-3xl md:gap-4 md:text-6xl">
        <span className="font-mono text-xs font-normal tracking-normal text-red md:text-sm">/{n}</span>
        {title}
      </h2>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.1em] text-ash hover:text-bone">
          <span className="max-sm:hidden">{link}</span><span className="sm:hidden">Все</span> <IconArrow className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

function EmptyShelf() {
  return (
    <div className="grid-bg mt-10 flex h-64 flex-col items-center justify-center border border-dashed border-line-strong text-center">
      <div className="h-display text-3xl text-ash">Полки пока пустые</div>
      <p className="mt-2 text-sm text-smoke">Скоро здесь появятся первые позиции.</p>
    </div>
  );
}
