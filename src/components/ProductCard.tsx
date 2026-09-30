import Link from "next/link";
import type { Condition } from "@prisma/client";
import { conditionLabel, formatPrice, formatYears, priceLabel } from "@/lib/format";
import { mediaUrl } from "@/lib/uploads-url";
import { IconArrow } from "./icons";

export type CardProduct = {
  slug: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  priceNote?: string | null;
  condition: Condition;
  conditionNote?: string | null;
  carMake: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  sku: string | null;
  inStock: boolean;
  images: { file: string }[];
};

export function ProductCard({ p, index = 0 }: { p: CardProduct; index?: number }) {
  const img = p.images[0];
  const car = [p.carMake, p.carModel].filter(Boolean).join(" ");
  const years = formatYears(p.yearFrom, p.yearTo);

  return (
    <Link
      href={`/catalog/${p.slug}`}
      data-reveal
      className="group relative flex flex-col border border-line bg-coal transition-colors duration-300 hover:border-line-strong"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-steel">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(img.file, "sm")}
            alt={p.title}
            loading={index < 4 ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-700 ease-out-hard group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid-bg flex h-full items-center justify-center">
            <span className="label">Нет фото</span>
          </div>
        )}
        <div className="absolute left-0 top-0 flex max-w-[calc(100%-8px)] gap-px">
          <span className="min-w-0 truncate bg-ink/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone backdrop-blur sm:px-2.5 sm:py-1 sm:text-[10px]">
            {conditionLabel(p)}
          </span>
          {!p.inStock && (
            <span className="shrink-0 bg-smoke px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink sm:px-2.5 sm:py-1 sm:text-[10px]">
              <span className="sm:hidden">Нет</span>
              <span className="max-sm:hidden">Нет в наличии</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <div className="flex min-h-[1lh] items-center gap-2 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ash sm:text-[11px] sm:tracking-[0.14em]">
          {car && <span className="truncate text-bone/80">{car}</span>}
          {years && <span className="hidden text-smoke sm:inline">{years}</span>}
        </div>
        <h3 className="mt-1.5 line-clamp-3 font-display text-[16px] font-bold uppercase leading-[1.08] sm:mt-2 sm:line-clamp-2 sm:text-[21px] sm:leading-[1.05]">
          {p.title}
        </h3>
        {p.sku && <div className="mt-2 hidden font-mono text-xs text-smoke sm:block">арт. {p.sku}</div>}

        <div className="mt-auto flex items-end justify-between pt-3 sm:pt-5">
          <div>
            {p.oldPrice && p.price && p.oldPrice > p.price && (
              <div className="font-mono text-[10px] text-smoke line-through sm:text-xs">{formatPrice(p.oldPrice)}</div>
            )}
            <div className={`font-display font-bold leading-tight tracking-tight ${p.price == null ? "text-base sm:text-xl" : "text-lg sm:text-2xl"}`}>
              {priceLabel(p)}
            </div>
            {p.price != null && p.priceNote && <div className="truncate font-mono text-[10px] text-smoke sm:text-xs">{p.priceNote}</div>}
          </div>
          <span className="hidden h-10 w-10 items-center justify-center border border-line-strong transition-all duration-300 group-hover:border-red group-hover:bg-red sm:flex">
            <IconArrow className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-red transition-transform duration-500 ease-out-hard group-hover:scale-x-100" />
    </Link>
  );
}
