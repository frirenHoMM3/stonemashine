"use client";
import { useState } from "react";
import type { Section } from "@/lib/format";
import { IconDown, IconPlus, IconTrash, IconUp } from "../icons";

const PRESETS = ["Комплектация", "Дефекты", "Совместимость", "Доставка", "Гарантия", "Установка"];

export function SectionsEditor({ initial }: { initial: Section[] }) {
  const [rows, setRows] = useState<Section[]>(initial);
  const set = (i: number, patch: Partial<Section>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const used = new Set(rows.map((r) => r.t));

  return (
    <div>
      <input type="hidden" name="sections" value={JSON.stringify(rows.filter((r) => r.t.trim() || r.b.trim()))} />
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="border border-line bg-coal">
            <div className="flex border-b border-line">
              <input
                value={r.t}
                onChange={(e) => set(i, { t: e.target.value })}
                placeholder="Заголовок раздела"
                maxLength={200}
                className="h-11 min-w-0 flex-1 bg-transparent px-3 font-display text-lg font-bold uppercase placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:normal-case placeholder:text-smoke focus:outline-none"
              />
              <IconBtn label="Выше" onClick={() => move(i, -1)} disabled={i === 0}><IconUp width={14} /></IconBtn>
              <IconBtn label="Ниже" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><IconDown width={14} /></IconBtn>
              <IconBtn label="Удалить раздел" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} danger><IconTrash width={14} /></IconBtn>
            </div>
            <textarea
              value={r.b}
              onChange={(e) => set(i, { b: e.target.value })}
              placeholder="Любой текст. Списки через «- », **жирный**, ссылки вставляются как есть"
              rows={4}
              maxLength={20000}
              className="block min-h-24 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed placeholder:text-smoke focus:outline-none [field-sizing:content]"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setRows((r) => [...r, { t: "", b: "" }])} className="btn btn-ghost btn-sm">
          <IconPlus width={14} /> Свой раздел
        </button>
        {PRESETS.filter((p) => !used.has(p)).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setRows((r) => [...r, { t: p, b: "" }])}
            className="border border-dashed border-line-strong px-2.5 py-1 font-mono text-[11px] text-ash hover:border-bone hover:text-bone"
          >
            + {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, label, disabled, danger }: {
  children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex w-10 shrink-0 items-center justify-center border-l border-line text-smoke disabled:opacity-20 ${danger ? "hover:bg-red hover:text-white" : "hover:bg-steel hover:text-bone"}`}
    >
      {children}
    </button>
  );
}
