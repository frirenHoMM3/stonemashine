"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveProduct } from "@/app/admin/actions";
import { CONDITIONS, CONDITION_LABEL, type Section, type Spec } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { Field, FormMessage, Toggle, useKeepForm } from "./ui";
import { ImageManager, type Img } from "./ImageManager";
import { SpecsEditor } from "./SpecsEditor";
import { SectionsEditor } from "./SectionsEditor";
import { Combobox, Dropdown } from "../Dropdown";

const CONDITION_OPTIONS = CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }));

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
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const e = state?.fieldErrors ?? {};

  // Ошибка в поле, спрятанном в свёрнутом блоке, — раскрываем блок и прокручиваем к нему
  useEffect(() => {
    const first = Object.keys(e)[0];
    if (!first || !form.current) return;
    const el = form.current.querySelector<HTMLElement>(`[name="${first}"]`);
    el?.closest("details")?.setAttribute("open", "");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+S / ⌘S — сохранить
  useEffect(() => {
    const on = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        form.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // Не даём случайно уйти с несохранёнными правками
  useEffect(() => {
    if (!dirty || pending) return;
    const beforeUnload = (ev: BeforeUnloadEvent) => ev.preventDefault();
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || ev.defaultPrevented) return;
      if (!window.confirm("Есть несохранённые изменения. Уйти без сохранения?")) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, pending]);

  const filled = (...vals: unknown[]) => vals.filter((v) => (Array.isArray(v) ? v.length : !!v)).length;

  return (
    <form
      ref={form}
      onSubmit={onSubmit}
      onInput={() => setDirty(true)}
      onChange={() => setDirty(true)}
      className="grid gap-8 pb-24 xl:grid-cols-[1fr_300px] xl:gap-10 xl:pb-0"
    >
      <div className="min-w-0 space-y-6">
        <FormMessage state={state} />

        {/* ——— ГЛАВНОЕ ——— */}
        <div className="space-y-5 border border-line bg-coal/50 p-4 sm:p-6">
          <ImageManager initial={p.images} onBusyChange={setUploading} onChange={() => setDirty(true)} />

          <Field label="Название" error={e.title}>
            <input
              name="title"
              value={title}
              onChange={(ev) => {
                setTitle(ev.target.value);
                if (!slugTouched) setSlug(slugify(ev.target.value));
              }}
              required
              maxLength={300}
              placeholder="Например: Фара передняя левая LED"
              className="field h-12 text-lg"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            <Field label="Цена, ₽" error={e.price} hint="Пусто — «Цена по запросу»">
              <input name="price" inputMode="decimal" defaultValue={p.price} className="field h-12 font-mono text-lg" placeholder="12 500" />
            </Field>
            <Field label="Приписка к цене" error={e.priceNote} hint="«за пару», «договорная», «от»">
              <input name="priceNote" defaultValue={p.priceNote} maxLength={120} className="field h-12" />
            </Field>
          </div>

          <Field label="Ссылка на объявление" error={e.avitoUrl} hint="Куда ведёт кнопка «Купить»: Авито, Дром — любая. Пусто — будет кнопка «Позвонить»">
            <input name="avitoUrl" defaultValue={p.avitoUrl} placeholder="https://www.avito.ru/..." className="field h-12 font-mono text-sm" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Категория" as="div">
              <Dropdown
                name="categoryId"
                value={categoryId}
                onChange={setCategoryId}
                size="lg"
                options={[
                  { value: "", label: "— без категории —" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                  { value: "__new", label: "+ Создать новую…" },
                ]}
              />
            </Field>
            <Field label="Состояние" as="div">
              <Dropdown name="condition" defaultValue={p.condition} size="lg" options={CONDITION_OPTIONS} />
            </Field>
          </div>
          {categoryId === "__new" && (
            <Field label="Название новой категории" className="animate-rise [animation-duration:.25s]">
              <input name="categoryNew" autoFocus maxLength={60} placeholder="Например: Салон" className="field h-12" />
            </Field>
          )}
        </div>

        <p className="font-mono text-[11px] uppercase tracking-wider text-smoke">Остальное — по желанию. Нажмите на блок, чтобы раскрыть</p>

        {/* ——— ДОПОЛНИТЕЛЬНО ——— */}
        <Block title="Машина и номера" hint="марка, модель, годы, артикул, OEM" count={filled(p.carMake, p.carModel, p.yearFrom, p.yearTo, p.sku, p.oem, p.brand)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Марка" error={e.carMake} as="div" hint="Выберите из списка или впишите свою">
              <Combobox name="carMake" options={makes} defaultValue={p.carMake} placeholder="Toyota" />
            </Field>
            <Field label="Модель" error={e.carModel} as="div">
              <Combobox name="carModel" options={models} defaultValue={p.carModel} placeholder="Camry XV70" />
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
              <input name="brand" defaultValue={p.brand} className="field" placeholder="Оригинал, Bosch, Febi…" />
            </Field>
          </div>
        </Block>

        <Block title="Описание" hint="любой текст про деталь" count={filled(p.description)}>
          <Field label="Текст" error={e.description} hint="«- » в начале строки — список · **слово** — жирный · ссылки кликабельны">
            <textarea name="description" rows={6} defaultValue={p.description} maxLength={50000} className="field min-h-36 [field-sizing:content]" />
          </Field>
        </Block>

        <Block title="Характеристики" hint="таблица «параметр — значение»" count={p.specs.length}>
          <SpecsEditor initial={p.specs} />
        </Block>

        <Block title="Свои разделы" hint="комплектация, дефекты, что угодно" count={p.sections.length}>
          <SectionsEditor initial={p.sections} />
        </Block>

        <Block title="Ещё" hint="старая цена, своё состояние, адрес страницы" count={filled(p.oldPrice, p.conditionNote)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Старая цена, ₽" error={e.oldPrice} hint="Покажется зачёркнутой рядом с ценой">
              <input name="oldPrice" inputMode="decimal" defaultValue={p.oldPrice} className="field font-mono" />
            </Field>
            <Field label="Своя подпись состояния" error={e.conditionNote} hint="Заменит «Б/у», «Новое» и т. п.">
              <input name="conditionNote" defaultValue={p.conditionNote} maxLength={120} placeholder="Б/у, как новое" className="field" />
            </Field>
            <Field label="Адрес страницы" error={e.slug} hint={`Сайт/catalog/${slug || "…"}`} className="sm:col-span-2">
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
          </div>
        </Block>
      </div>

      {/* ——— ПРАВАЯ КОЛОНКА: ПОКАЗ И СОХРАНЕНИЕ ——— */}
      <aside className="space-y-2 xl:sticky xl:top-10 xl:self-start">
        <Toggle name="published" label="Показывать на сайте" defaultChecked={p.published} />
        <Toggle name="inStock" label="В наличии" defaultChecked={p.inStock} />
        <Toggle name="featured" label="Первым на главной" defaultChecked={p.featured} />

        <div className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-2 border-t border-line bg-ink/95 p-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] xl:static xl:border-0 xl:bg-transparent xl:p-0 xl:pt-4 xl:backdrop-blur-none">
          <button className="btn btn-red flex-1 xl:w-full xl:flex-none" disabled={pending || uploading}>
            {pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />}
            {uploading ? "Фото грузятся…" : pending ? "Сохраняю…" : "Сохранить"}
          </button>
          {!p.id && (
            <button name="next" value="new" className="btn btn-ghost max-sm:hidden xl:w-full" disabled={pending || uploading}>
              Сохранить и добавить ещё
            </button>
          )}
          <Link href="/admin/products" className="btn btn-ghost xl:w-full">Отмена</Link>
          <div className="hidden w-full text-center font-mono text-[10px] uppercase tracking-wider text-smoke xl:block">
            {dirty ? "● есть несохранённые изменения" : "Ctrl+S — сохранить"}
          </div>
        </div>
      </aside>
    </form>
  );
}

function Block({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <details open={count > 0} className="group border border-line open:border-line-strong">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 hover:bg-coal sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-line-strong font-mono text-sm transition-transform group-open:rotate-45 group-open:border-red group-open:text-red">+</span>
        <span className="font-display text-lg font-bold uppercase">{title}</span>
        <span className="hidden truncate text-sm text-smoke sm:inline">— {hint}</span>
        {count > 0 && <span className="ml-auto shrink-0 font-mono text-xs text-ok">заполнено: {count}</span>}
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-5 sm:px-5">{children}</div>
    </details>
  );
}
