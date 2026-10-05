"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/*
  Свои выпадающие списки вместо <select> и <datalist>.
  Нативные внутри <label> в Firefox/Linux закрывались от любого клика, а datalist — от движения мыши.
  Здесь список закрывается только при выборе, клике мимо или Esc.
*/

export type Option = { value: string; label: string };

// Закрытие по клику мимо (pointerdown — срабатывает раньше, чем фокус уедет) и Esc
function useDismiss(open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, refs]);
}

// Раскрываем вверх, если снизу не хватает места (актуально на телефоне)
function useFlip(open: boolean, anchor: React.RefObject<HTMLElement | null>) {
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < 280 && r.top > window.innerHeight - r.bottom);
  }, [open, anchor]);
  return up;
}

function emitChange(input: HTMLInputElement | null) {
  // Чтобы формы, которые слушают change (автоотправка фильтров, «есть изменения»), узнали о выборе
  input?.dispatchEvent(new Event("change", { bubbles: true }));
}

const LIST = "absolute left-0 right-0 z-50 max-h-72 overflow-y-auto overscroll-contain border border-line-strong bg-coal py-1 shadow-2xl shadow-black/70";

export function Dropdown({
  name, options, value, defaultValue = "", onChange, placeholder = "Выберите", className = "", size = "md", ariaLabel,
}: {
  name?: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const id = useId();
  const refs = useRef([root]).current;
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, refs);
  const up = useFlip(open, button);

  const selected = options.find((o) => o.value === current);

  const pick = (v: string) => {
    setInner(v);
    setOpen(false);
    button.current?.focus();
    if (hidden.current) hidden.current.value = v;
    onChange?.(v);
    emitChange(hidden.current);
  };

  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, options.findIndex((o) => o.value === current));
    setActive(i);
    requestAnimationFrame(() => list.current?.children[i]?.scrollIntoView({ block: "nearest" }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = (active + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      setActive(n);
      list.current?.children[n]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) pick(options[active].value);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1) {
      // Быстрый переход по первой букве
      const k = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      const j = k >= 0 ? k : options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (j >= 0) {
        setActive(j);
        list.current?.children[j]?.scrollIntoView({ block: "nearest" });
      }
    }
  };

  const h = size === "sm" ? "h-9 text-sm" : size === "lg" ? "h-12" : "h-11";

  return (
    <div ref={root} className={`relative ${className}`}>
      {name && <input ref={hidden} type="hidden" name={name} value={current} data-dropdown />}
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`field flex ${h} items-center justify-between gap-2 text-left ${open ? "!border-red" : ""}`}
      >
        <span className={`truncate ${selected ? "" : "text-smoke"}`}>{selected?.label ?? placeholder}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" className={`shrink-0 text-ash transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l4 4 4-4" /></svg>
      </button>

      {open && (
        <ul ref={list} id={id} role="listbox" className={`${LIST} ${up ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === current}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                i === active ? "bg-steel text-bone" : "text-bone/85"
              } ${o.value === current ? "font-semibold" : ""}`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === current && <span className="text-red">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Поле с подсказками: можно выбрать из списка или написать своё (марка, модель)
export function Combobox({
  name, options, defaultValue = "", placeholder, className = "",
}: {
  name: string;
  options: string[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const refs = useRef([root]).current;
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, refs);
  const up = useFlip(open, input);

  const q = text.trim().toLowerCase();
  const matches = options.filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q).slice(0, 50);

  const pick = (v: string) => {
    setText(v);
    setOpen(false);
    requestAnimationFrame(() => emitChange(input.current));
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <input
        ref={input}
        name={name}
        value={text}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !matches.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
        className="field"
      />
      {open && matches.length > 0 && (
        <ul role="listbox" className={`${LIST} ${up ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === active}
              // mousedown, а не click: иначе поле теряет фокус раньше, чем выбор засчитается
              onPointerDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onPointerEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2.5 text-sm ${i === active ? "bg-steel text-bone" : "text-bone/85"}`}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Меню действий («⋯»): тот же принцип закрытия, что и у списков
export function Menu({ trigger, children, className = "" }: { trigger: React.ReactNode; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const refs = useRef([root]).current;
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, refs);
  const up = useFlip(open, button);
  return (
    <div ref={root} className={`relative ${className}`}>
      <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="btn btn-ghost btn-sm px-3">
        {trigger}
      </button>
      {open && (
        <div role="menu" onClick={(e) => (e.target as HTMLElement).closest("a,button") && setTimeout(close, 0)} className={`absolute right-0 z-50 w-64 border border-line-strong bg-coal py-1 shadow-2xl shadow-black/70 ${up ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {children}
        </div>
      )}
    </div>
  );
}
