import Link from "next/link";
import type { Condition } from "@prisma/client";
import { CONDITION_LABEL, formatPrice, formatYears } from "@/lib/format";
import { mediaUrl } from "@/lib/uploads-url";
import { IconArrow } from "./icons";

export type CardProduct = {
  slug: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  condition: Condition;
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
        <div className="absolute left-0 top-0 flex gap-px">
          <span className="bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-bone backdrop-blur">
            {CONDITION_LABEL[p.condition]}
          </span>
          {!p.inStock && (
            <span className="bg-smoke px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink">
              Нет в наличии
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="label flex min-h-[1lh] items-center gap-2 truncate">
          {car && <span className="truncate text-bone/80">{car}</span>}
          {years && <span className="text-smoke">{years}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 font-display text-[21px] font-bold uppercase leading-[1.05] tracking-[0.01em]">
          {p.title}
        </h3>
        {p.sku && <div className="mt-2 font-mono text-xs text-smoke">арт. {p.sku}</div>}

        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            {p.oldPrice && p.price && p.oldPrice > p.price && (
              <div className="font-mono text-xs text-smoke line-through">{formatPrice(p.oldPrice)}</div>
            )}
            <div className="font-display text-2xl font-bold tracking-tight">{formatPrice(p.price)}</div>
          </div>
          <span className="flex h-10 w-10 items-center justify-center border border-line-strong transition-all duration-300 group-hover:border-red group-hover:bg-red">
            <IconArrow className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-red transition-transform duration-500 ease-out-hard group-hover:scale-x-100" />
    </Link>
  );
}
