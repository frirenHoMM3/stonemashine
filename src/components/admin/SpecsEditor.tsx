"use client";
import { useState } from "react";
import type { Spec } from "@/lib/format";
import { IconDown, IconPlus, IconTrash, IconUp } from "../icons";

const PRESETS = ["Объём двигателя", "Код двигателя", "Тип КПП", "Сторона установки", "Пробег", "Цвет", "Материал", "Вес, кг", "Гарантия"];

export function SpecsEditor({ initial }: { initial: Spec[] }) {
  const [rows, setRows] = useState<Spec[]>(initial.length ? initial : [{ k: "", v: "" }]);
  const set = (i: number, patch: Partial<Spec>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const used = new Set(rows.map((r) => r.k));

  return (
    <div>
      <input type="hidden" name="specs" value={JSON.stringify(rows.filter((r) => r.k.trim() || r.v.trim()))} />
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-stretch">
            <textarea
              value={r.k}
              onChange={(e) => set(i, { k: e.target.value })}
              placeholder="Параметр"
              rows={1}
              maxLength={200}
              className="field min-h-10 w-2/5 resize-none py-2 text-sm [field-sizing:content]"
            />
            <textarea
              value={r.v}
              onChange={(e) => set(i, { v: e.target.value })}
              placeholder="Значение (можно в несколько строк)"
              rows={1}
              maxLength={2000}
              className="field -ml-px min-h-10 flex-1 resize-none py-2 text-sm [field-sizing:content]"
            />
            <div className="-ml-px flex shrink-0 flex-col border border-line max-sm:hidden">
              <RowBtn label="Выше" onClick={() => move(i, -1)} disabled={i === 0}><IconUp width={12} /></RowBtn>
              <RowBtn label="Ниже" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><IconDown width={12} /></RowBtn>
            </div>
            <button
              type="button"
              onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : [{ k: "", v: "" }]))}
              className="-ml-px flex w-10 shrink-0 items-center justify-center border border-line text-smoke hover:border-red hover:bg-red hover:text-white"
              aria-label="Удалить строку"
            >
              <IconTrash width={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setRows((r) => [...r, { k: "", v: "" }])} className="btn btn-ghost btn-sm">
          <IconPlus width={14} /> Своя строка
        </button>
        {PRESETS.filter((p) => !used.has(p)).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() =>
              setRows((r) => {
                const empty = r.findIndex((x) => !x.k && !x.v);
                if (empty >= 0) return r.map((x, k) => (k === empty ? { k: p, v: "" } : x));
                return [...r, { k: p, v: "" }];
              })
            }
            className="border border-dashed border-line-strong px-2.5 py-1 font-mono text-[11px] text-ash hover:border-bone hover:text-bone"
          >
            + {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RowBtn({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className="flex flex-1 items-center justify-center px-2 text-smoke hover:bg-steel hover:text-bone disabled:opacity-20">
      {children}
    </button>
  );
}
