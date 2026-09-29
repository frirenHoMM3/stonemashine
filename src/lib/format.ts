import type { Condition } from "@prisma/client";

export const CONDITION_LABEL: Record<Condition, string> = {
  NEW: "Новое",
  USED: "Б/у",
  CONTRACT: "Контрактное",
  REFURBISHED: "Восстановленное",
};

export const CONDITIONS = Object.keys(CONDITION_LABEL) as Condition[];

const rub = new Intl.NumberFormat("ru-RU");
export const formatPrice = (v: number | null | undefined) =>
  v == null ? "Цена по запросу" : `${rub.format(v)} ₽`;

export function formatYears(from?: number | null, to?: number | null) {
  if (from && to) return from === to ? `${from}` : `${from}–${to}`;
  if (from) return `с ${from}`;
  if (to) return `до ${to}`;
  return null;
}

export type Spec = { k: string; v: string };
export function parseSpecs(json: unknown): Spec[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (s): s is Spec => !!s && typeof s.k === "string" && typeof s.v === "string",
  );
}
