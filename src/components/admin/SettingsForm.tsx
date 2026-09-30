"use client";
import { saveSettings } from "@/app/admin/actions";
import { Field, FormMessage, PendingButton, useKeepForm } from "./ui";

const HINTS: Record<string, string> = {
  tagline: "Последнее слово на главной подсвечивается красным",
  phone: "Как показывать: +7 900 000-00-00",
  avitoProfile: "https://www.avito.ru/user/…/profile",
  about: "Пара абзацев о магазине. Переносы строк сохраняются.",
  yandexVerification: "webmaster.yandex.ru → Добавить сайт → Мета-тег. Можно вставить тег целиком",
  googleVerification: "search.google.com/search-console → Тег HTML. Можно вставить тег целиком",
  metrikaId: "metrika.yandex.ru → номер счётчика (только цифры). Вебвизор включится сам",
};

export function SettingsForm({ values, labels }: { values: Record<string, string>; labels: Record<string, string> }) {
  const { state, pending, onSubmit } = useKeepForm(saveSettings);
  const e = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {Object.entries(labels).map(([key, label]) => (
        <Field key={key} label={label} error={e[key]} hint={HINTS[key]}>
          {key === "about" ? (
            <textarea name={key} defaultValue={values[key]} rows={6} className="field" />
          ) : (
            <input name={key} defaultValue={values[key]} className="field" />
          )}
        </Field>
      ))}
      <FormMessage state={state} />
      <PendingButton pending={pending}>Сохранить</PendingButton>
    </form>
  );
}
