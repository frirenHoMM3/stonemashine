"use client";
import { saveSettings } from "@/app/admin/actions";
import { Field, FormMessage, PendingButton, useKeepForm } from "./ui";

type F = { key: string; placeholder?: string; hint?: string; long?: boolean };

const GROUPS: { title: string; note?: string; fields: F[] }[] = [
  {
    title: "Магазин",
    fields: [
      { key: "shopName", placeholder: "STONEMACHINE" },
      { key: "tagline", placeholder: "Запчасти, которые держат нагрузку", hint: "Большой заголовок на главной. Последнее слово — красным" },
      { key: "about", long: true, hint: "Блок «О нас» внизу главной" },
    ],
  },
  {
    title: "Контакты",
    note: "Пустые поля на сайте просто не показываются",
    fields: [
      { key: "phone", placeholder: "+7 900 000-00-00" },
      { key: "telegram", placeholder: "stonemachine_parts", hint: "Можно вставить ссылку t.me/… — лишнее уберётся само" },
      { key: "whatsapp", placeholder: "79000000000" },
      { key: "avitoProfile", placeholder: "https://www.avito.ru/user/…/profile" },
      { key: "address", placeholder: "Москва, ул. Складская, 1" },
      { key: "hours", placeholder: "Пн–Сб 10:00–19:00" },
    ],
  },
  {
    title: "Поисковики и статистика",
    note: "Нужно только после подключения домена",
    fields: [
      { key: "yandexVerification", hint: "Вебмастер → Добавить сайт → Мета-тег. Вставьте тег целиком" },
      { key: "googleVerification", hint: "Search Console → Тег HTML. Вставьте тег целиком" },
      { key: "metrikaId", placeholder: "12345678", hint: "Только цифры номера счётчика" },
    ],
  },
];

export function SettingsForm({ values, labels }: { values: Record<string, string>; labels: Record<string, string> }) {
  const { state, pending, onSubmit } = useKeepForm(saveSettings);
  const e = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-10 pb-24 lg:pb-0">
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="space-y-4">
          <legend className="mb-4 w-full border-b border-line pb-2">
            <span className="font-display text-xl font-bold uppercase">{g.title}</span>
            {g.note && <span className="ml-3 text-xs text-smoke">{g.note}</span>}
          </legend>
          {g.fields.map((f) => (
            <Field key={f.key} label={labels[f.key].split(":")[0]} error={e[f.key]} hint={f.hint}>
              {f.long ? (
                <textarea name={f.key} defaultValue={values[f.key]} rows={5} className="field [field-sizing:content] min-h-28" />
              ) : (
                <input name={f.key} defaultValue={values[f.key]} placeholder={f.placeholder} className="field" />
              )}
            </Field>
          ))}
        </fieldset>
      ))}
      <div className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-line bg-ink/95 p-3 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <FormMessage state={state} />
        <PendingButton pending={pending} className="btn btn-red w-full sm:w-auto">Сохранить настройки</PendingButton>
      </div>
    </form>
  );
}
