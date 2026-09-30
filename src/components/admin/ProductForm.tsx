"use client";
import Link from "next/link";
import { useState } from "react";
import { saveProduct } from "@/app/admin/actions";
import { CONDITIONS, CONDITION_LABEL, type Section, type Spec } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { Field, FormMessage, PendingButton, Toggle, useKeepForm } from "./ui";
import { ImageManager, type Img } from "./ImageManager";
import { SpecsEditor } from "./SpecsEditor";
import { SectionsEditor } from "./SectionsEditor";

export type ProductFormData = {
  id: string | null;
  title: string; slug: string; avitoUrl: string; sku: string; oem: string; brand: string;
  carMake: string; carModel: string; yearFrom: string; yearTo: string; price: string; oldPrice: string;
  priceNote: string; condition: string; conditionNote: string; categoryId: string; description: string;
  inStock: boolean; featured: boolean; published: boolean;
  images: Img[]; specs: Spec[]; sections: Section[];
};

export function ProductForm({ p, categories, makes, models }: {
  p: ProductFormData;
  categories: { id: string; name: string }[];
  makes: string[];
  models: string[];
}) {
  const { state, pending, onSubmit } = useKeepForm(saveProduct.bind(null, p.id));
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [slugTouched, setSlugTouched] = useState(!!p.id);
  const [slug, setSlug] = useState(p.slug);
  const [categoryId, setCategoryId] = useState(p.categoryId);
  const e = state?.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="grid gap-8 pb-24 xl:grid-cols-[1fr_340px] xl:gap-10 xl:pb-0">
      <div className="space-y-10">
        <FormMessage state={state} />

        <Section n="01" title="Основное">
          <Field label="Название *" error={e.title}>
            <input
              name="title"
              value={title}
              onChange={(ev) => {
                setTitle(ev.target.value);
                if (!slugTouched) setSlug(slugify(ev.target.value));
              }}
              required
              maxLength={300}
              placeholder="Фара передняя левая LED"
              className="field text-lg"
            />
          </Field>
          <Field label="Ссылка «Купить»" error={e.avitoUrl} hint="Авито, Дром, мессенджер — любая. Пусто — вместо кнопки покупки будут контакты">
            <input name="avitoUrl" defaultValue={p.avitoUrl} placeholder="https://www.avito.ru/..." className="field font-mono text-sm" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Цена, ₽" error={e.price} hint="Можно «12 500 ₽»">
              <input name="price" inputMode="decimal" defaultValue={p.price} className="field font-mono" placeholder="12500" />
            </Field>
            <Field label="Старая цена, ₽" error={e.oldPrice} hint="Зачёркнутая">
              <input name="oldPrice" inputMode="decimal" defaultValue={p.oldPrice} className="field font-mono" />
            </Field>
            <Field label="К цене" error={e.priceNote} hint="«за пару», «договорная»">
              <input name="priceNote" defaultValue={p.priceNote} maxLength={120} className="field" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Состояние" hint="Для фильтров и поисковиков">
              <select name="condition" defaultValue={p.condition} className="field">
                {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
              </select>
            </Field>
            <Field label="Своя подпись состояния" error={e.conditionNote} hint="Покажется вместо стандартной">
              <input name="conditionNote" defaultValue={p.conditionNote} maxLength={120} placeholder="Б/у, отличное" className="field" />
            </Field>
            <Field label="Категория">
              <select name="categoryId" value={categoryId} onChange={(ev) => setCategoryId(ev.target.value)} className="field">
                <option value="">— без категории —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new">+ Новая категория…</option>
              </select>
            </Field>
            {categoryId === "__new" && (
              <Field label="Название новой категории">
                <input name="categoryNew" autoFocus maxLength={60} placeholder="Например, «Салон»" className="field" />
              </Field>
            )}
          </div>
        </Section>

        <Section n="02" title="Фото">
          <ImageManager initial={p.images} onBusyChange={setUploading} />
        </Section>

        <Section n="03" title="Применимость и номера">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Марка авто" error={e.carMake}>
              <input name="carMake" list="makes" defaultValue={p.carMake} className="field" placeholder="Toyota" />
            </Field>
            <Field label="Модель" error={e.carModel}>
              <input name="carModel" list="models" defaultValue={p.carModel} className="field" placeholder="Camry XV70" />
            </Field>
            <Field label="Год с" error={e.yearFrom}>
              <input name="yearFrom" inputMode="numeric" defaultValue={p.yearFrom} className="field font-mono" placeholder="2017" />
            </Field>
            <Field label="Год по" error={e.yearTo}>
              <input name="yearTo" inputMode="numeric" defaultValue={p.yearTo} className="field font-mono" placeholder="2021" />
            </Field>
            <Field label="Артикул" error={e.sku}>
              <input name="sku" defaultValue={p.sku} className="field font-mono" />
            </Field>
            <Field label="OEM-номер" error={e.oem} hint="Можно несколько через запятую">
              <input name="oem" defaultValue={p.oem} className="field font-mono" />
            </Field>
            <Field label="Производитель детали" error={e.brand} className="sm:col-span-2">
              <input name="brand" defaultValue={p.brand} className="field" placeholder="Оригинал / Bosch / Febi…" />
            </Field>
          </div>
          <datalist id="makes">{makes.map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
        </Section>

        <Section n="04" title="Описание">
          <Field label="Текст" error={e.description} hint="Пишите как угодно. «- » в начале строки — список, **текст** — жирный, ссылки кликабельны">
            <textarea name="description" rows={8} defaultValue={p.description} maxLength={50000} className="field min-h-40 [field-sizing:content]" />
          </Field>
        </Section>

        <Section n="05" title="Характеристики">
          <SpecsEditor initial={p.specs} />
        </Section>

        <Section n="06" title="Свои разделы">
          <SectionsEditor initial={p.sections} />
        </Section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-10 xl:self-start">
        <div className="space-y-2">
          <Toggle name="published" label="Показывать на сайте" defaultChecked={p.published} />
          <Toggle name="inStock" label="В наличии" defaultChecked={p.inStock} />
          <Toggle name="featured" label="Первым на главной" defaultChecked={p.featured} />
        </div>
        <Field label="Адрес страницы" error={e.slug} hint={`/catalog/${slug || "…"}`}>
          <input
            name="slug"
            value={slug}
            onChange={(ev) => {
              setSlugTouched(true);
              setSlug(ev.target.value);
            }}
            className="field font-mono text-sm"
          />
        </Field>
        {/* На мобилке кнопки прилипают к низу экрана — длинную форму не надо листать до конца */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-ink/95 p-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] xl:static xl:border-0 xl:bg-transparent xl:p-0 xl:pt-2 xl:backdrop-blur-none">
          {uploading ? (
            <button disabled className="btn btn-red flex-1">Фото загружаются…</button>
          ) : (
            <PendingButton pending={pending} className="btn btn-red flex-1">{p.id ? "Сохранить" : "Создать"}</PendingButton>
          )}
          <Link href="/admin" className="btn btn-ghost">Отмена</Link>
        </div>
      </aside>
    </form>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 flex items-baseline gap-3 border-b border-line pb-3 font-display text-2xl font-bold uppercase">
        <span className="font-mono text-xs font-normal text-red">/{n}</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
