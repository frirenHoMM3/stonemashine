import type { Prisma } from "@prisma/client";

// «Требует внимания» — то, из-за чего карточка выглядит недоделанной или не продаёт
export const NEEDS_ATTENTION: Prisma.ProductWhereInput = {
  deletedAt: null,
  OR: [
    { images: { none: {} } },
    { price: null, priceNote: null },
    { avitoUrl: null },
  ],
};

export function problems(p: { images: unknown[]; price: number | null; priceNote: string | null; avitoUrl: string | null }) {
  const out: string[] = [];
  if (!p.images.length) out.push("нет фото");
  if (p.price == null && !p.priceNote) out.push("нет цены");
  if (!p.avitoUrl) out.push("нет ссылки");
  return out;
}
