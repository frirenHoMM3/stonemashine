"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { bulkProducts, deleteProduct, duplicateProduct, purgeProduct, restoreProduct, toggleProductFlag } from "@/app/admin/actions";
import { mediaUrl } from "@/lib/uploads-url";
import { ConfirmButton } from "./ui";
import { IconExternal } from "../icons";
import { Dropdown, Menu } from "../Dropdown";

export type Row = {
  id: string; slug: string; title: string; thumb: string | null; price: string; meta: string[]; views: number;
  published: boolean; inStock: boolean; featured: boolean; problems: string[]; deletedAt: string | null;
};

export function ProductTable({ rows, trash, categories }: { rows: Row[]; trash: boolean; categories: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Сменилась страница/фильтр — выделение сбрасываем
  const key = rows.map((r) => r.id).join();
  useEffect(() => setSelected(new Set()), [key]);

  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = (action: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("action", action);
    fd.set("ids", JSON.stringify([...selected]));
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    start(async () => {
      await bulkProducts(fd);
      setSelected(new Set());
      setConfirmDelete(false);
    });
  };

  return (
    <div className={pending ? "pointer-events-none opacity-60 transition-opacity" : ""}>
      <div className="mt-4 flex items-center gap-3 border-b border-line pb-2 text-sm text-ash">
        <Check checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} label="Выбрать все на странице" />
        <span>{selected.size ? `Выбрано: ${selected.size}` : "Выбрать все"}</span>
      </div>

      <ul className="divide-y divide-line">
        {rows.map((p) => (
          <li key={p.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:gap-4 lg:flex-nowrap ${selected.has(p.id) ? "bg-red/5" : ""}`}>
            <Check checked={selected.has(p.id)} onChange={() => toggle(p.id)} label={`Выбрать «${p.title}»`} />

            <Link href={`/admin/products/${p.id}`} className="h-14 w-16 shrink-0 overflow-hidden border border-line bg-steel sm:h-16 sm:w-20">
              {p.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(p.thumb, "sm")} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-[10px] text-red-hot">нет фото</div>
              )}
            </Link>

            <div className="min-w-0 flex-1 basis-40">
              <Link href={`/admin/products/${p.id}`} className="block truncate font-display text-lg font-bold uppercase leading-tight hover:text-red-hot">
                {p.title}
              </Link>
              <div className="mt-0.5 truncate font-mono text-xs text-smoke">
                {p.meta.join(" · ")}
                {p.views > 0 && ` · ${p.views} просм.`}
              </div>
              {p.problems.length > 0 && !trash && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.problems.map((x) => (
                    <span key={x} className="border border-red/40 px-1.5 font-mono text-[10px] uppercase tracking-wider text-red-hot">{x}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 text-right font-display text-lg font-bold lg:w-32">{p.price}</div>

            {trash ? (
              <div className="flex shrink-0 gap-1 max-lg:basis-full">
                <form action={restoreProduct} className="max-lg:flex-1">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn-ghost btn-sm w-full">Вернуть</button>
                </form>
                <form action={purgeProduct} className="max-lg:flex-1">
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton className="btn btn-ghost btn-sm w-full" confirm="Точно навсегда?">Удалить навсегда</ConfirmButton>
                </form>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-1 max-lg:basis-full">
                <Pill id={p.id} flag="published" on={p.published} yes="На сайте" no="Скрыт" />
                <Pill id={p.id} flag="inStock" on={p.inStock} yes="В наличии" no="Нет" />
                <Link href={`/admin/products/${p.id}`} className="btn btn-ghost btn-sm max-lg:flex-1">Изменить</Link>
                <More p={p} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Панель действий над выбранными — прилипает к низу экрана */}
      {selected.size > 0 && (
        <div className="animate-rise fixed inset-x-0 bottom-0 z-40 border-t border-red/60 bg-ink/95 backdrop-blur-md [animation-duration:.25s] [padding-bottom:env(safe-area-inset-bottom)] lg:left-[240px]">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-8 lg:px-12">
            <span className="mr-2 font-display text-lg font-bold uppercase">Выбрано: {selected.size}</span>
            {trash ? (
              <>
                <button onClick={() => run("restore")} className="btn btn-ghost btn-sm">Вернуть</button>
                <button onClick={() => (confirmDelete ? run("purge") : setConfirmDelete(true))} className={`btn btn-sm ${confirmDelete ? "btn-red" : "btn-ghost"}`}>
                  {confirmDelete ? "Точно удалить навсегда?" : "Удалить навсегда"}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => run("publish")} className="btn btn-ghost btn-sm">Показать на сайте</button>
                <button onClick={() => run("hide")} className="btn btn-ghost btn-sm">Скрыть</button>
                <button onClick={() => run("stock")} className="btn btn-ghost btn-sm">В наличии</button>
                <button onClick={() => run("nostock")} className="btn btn-ghost btn-sm">Нет в наличии</button>
                <Dropdown
                  key={selected.size}
                  size="sm"
                  className="w-48"
                  placeholder="В категорию…"
                  ariaLabel="Перенести в категорию"
                  onChange={(v) => run("category", { categoryId: v === "none" ? "" : v })}
                  options={[...categories.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "Без категории" }]}
                />
                <button onClick={() => (confirmDelete ? run("trash") : setConfirmDelete(true))} className={`btn btn-sm ${confirmDelete ? "btn-red" : "btn-ghost"}`}>
                  {confirmDelete ? "Точно в корзину?" : "Удалить"}
                </button>
              </>
            )}
            <button onClick={() => { setSelected(new Set()); setConfirmDelete(false); }} className="ml-auto font-mono text-xs uppercase tracking-wider text-smoke hover:text-bone">
              Снять выбор
            </button>
          </div>
        </div>
      )}
      {selected.size > 0 && <div className="h-28" />}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="peer sr-only" />
      <span className="flex h-5 w-5 items-center justify-center border border-line-strong transition-colors peer-checked:border-red peer-checked:bg-red peer-focus-visible:outline-2 peer-focus-visible:outline-red-hot">
        {checked && <svg viewBox="0 0 12 10" className="h-2.5 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 5l3.5 3.5L11 1" /></svg>}
      </span>
    </label>
  );
}

function Pill({ id, flag, on, yes, no }: { id: string; flag: string; on: boolean; yes: string; no: string }) {
  return (
    <form action={toggleProductFlag} className="max-lg:flex-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <button
        title="Нажмите, чтобы переключить"
        className={`h-9 w-full whitespace-nowrap border px-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          on ? "border-ok/50 text-ok hover:bg-ok/10" : "border-line text-smoke hover:border-line-strong hover:text-ash"
        }`}
      >
        {on ? `● ${yes}` : `○ ${no}`}
      </button>
    </form>
  );
}

// Редкие действия спрятаны в «⋯», чтобы строка не пестрела кнопками
function More({ p }: { p: Row }) {
  const item = "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-steel";
  return (
    <Menu trigger={<span aria-label="Ещё действия">⋯</span>}>
      {p.published && (
        <a href={`/catalog/${p.slug}`} target="_blank" className={item}>
          <IconExternal width={14} /> Открыть на сайте
        </a>
      )}
      <form action={toggleProductFlag}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="flag" value="featured" />
        <button className={item}>{p.featured ? "★ Убрать с главной" : "☆ Показывать первым на главной"}</button>
      </form>
      <form action={duplicateProduct}>
        <input type="hidden" name="id" value={p.id} />
        <button className={item}>⧉ Сделать копию</button>
      </form>
      <form action={deleteProduct} className="border-t border-line">
        <input type="hidden" name="id" value={p.id} />
        <button className={`${item} text-red-hot`}>✕ В корзину</button>
      </form>
    </Menu>
  );
}
