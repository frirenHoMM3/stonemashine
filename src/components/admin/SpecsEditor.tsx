"use client";
import { useState } from "react";
import type { Spec } from "@/lib/format";
import { IconPlus, IconTrash } from "../icons";

const PRESETS = ["Объём двигателя", "Код двигателя", "Тип КПП", "Сторона установки", "Пробег", "Цвет", "Материал", "Вес, кг"];

export function SpecsEditor({ initial }: { initial: Spec[] }) {
  const [rows, setRows] = useState<Spec[]>(initial.length ? initial : [{ k: "", v: "" }]);
  const set = (i: number, patch: Partial<Spec>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const used = new Set(rows.map((r) => r.k));

  return (
    <div>
      <input type="hidden" name="specs" value={JSON.stringify(rows.filter((r) => r.k.trim() && r.v.trim()))} />
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex">
            <input value={r.k} onChange={(e) => set(i, { k: e.target.value })} placeholder="Параметр" className="field h-10 w-2/5 text-sm" maxLength={80} />
            <input value={r.v} onChange={(e) => set(i, { v: e.target.value })} placeholder="Значение" className="field -ml-px h-10 flex-1 text-sm" maxLength={300} />
            <button
              type="button"
              onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : [{ k: "", v: "" }]))}
              className="-ml-px flex h-10 w-10 shrink-0 items-center justify-center border border-line text-smoke hover:border-red hover:bg-red hover:text-white"
              aria-label="Удалить строку"
            >
              <IconTrash width={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setRows((r) => [...r, { k: "", v: "" }])} className="btn btn-ghost btn-sm">
          <IconPlus width={14} /> Строка
        </button>
        {PRESETS.filter((p) => !used.has(p)).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setRows((r) => {
              const empty = r.findIndex((x) => !x.k && !x.v);
              if (empty >= 0) return r.map((x, k) => (k === empty ? { k: p, v: "" } : x));
              return [...r, { k: p, v: "" }];
            })}
            className="border border-dashed border-line-strong px-2.5 py-1 font-mono text-[11px] text-ash hover:border-bone hover:text-bone"
          >
            + {p}
          </button>
        ))}
      </div>
    </div>
  );
}
