import "server-only";
import { cache } from "react";
import { db } from "./db";

export const SETTING_KEYS = {
  shopName: "Название магазина",
  tagline: "Слоган на главной",
  phone: "Телефон",
  telegram: "Telegram (username без @)",
  whatsapp: "WhatsApp (номер, только цифры)",
  avitoProfile: "Ссылка на профиль Авито",
  address: "Адрес / город",
  hours: "Часы работы",
  about: "Текст «О нас»",
  yandexVerification: "Яндекс.Вебмастер: код подтверждения",
  googleVerification: "Google Search Console: код подтверждения",
  metrikaId: "Номер счётчика Яндекс.Метрики",
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;
export type Settings = Record<SettingKey, string>;

const DEFAULTS: Settings = {
  shopName: "STONEMACHINE",
  tagline: "Запчасти, которые держат нагрузку",
  phone: "",
  telegram: "",
  whatsapp: "",
  avitoProfile: "",
  address: "",
  hours: "",
  about: "",
  yandexVerification: "",
  googleVerification: "",
  metrikaId: "",
};

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.setting.findMany();
  const out = { ...DEFAULTS };
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
});
