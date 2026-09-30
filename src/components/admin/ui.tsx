"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/admin/actions";

export function SubmitButton({ children, pending: label = "Сохраняю…", className = "btn btn-red" }: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending && <span className="h-3 w-3 animate-spin border-2 border-current border-r-transparent rounded-full" />}
      {pending ? label : children}
    </button>
  );
}

// Двухшаговое подтверждение вместо window.confirm: первый клик взводит, второй — выполняет.
export function ConfirmButton({ children, confirm = "Точно?", className = "" }: {
  children: React.ReactNode;
  confirm?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type={armed ? "submit" : "button"}
      disabled={pending}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className={`${className} ${armed ? "!border-red !bg-red !text-white" : ""}`}
    >
      {pending ? "…" : armed ? confirm : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <div
      role="status"
      className={`animate-rise border-l-2 px-4 py-3 text-sm [animation-duration:.35s] ${
        state.error ? "border-red bg-red/10 text-bone" : "border-ok bg-ok/10 text-bone"
      }`}
    >
      {state.error ?? state.ok}
    </div>
  );
}

// as="div" — для выпадающих списков: внутри <label> браузер пересылает клики на кнопку списка
export function Field({ label, error, hint, children, className = "", as: Tag = "label" }: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  as?: "label" | "div";
}) {
  return (
    <Tag className={`block ${className}`}>
      <span className="label mb-2 flex justify-between gap-2">
        {label}
        {error && <span className="normal-case tracking-normal text-red-hot">{error}</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-smoke">{hint}</span>}
    </Tag>
  );
}

export function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border border-line bg-coal px-4 py-3 hover:border-line-strong">
      <span className="text-sm">{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 bg-line-strong transition-colors peer-checked:bg-red peer-focus-visible:outline-2 peer-focus-visible:outline-red-hot after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:bg-bone after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

// Форма с action={...} в React 19 очищается после отправки — при ошибке валидации
// админ потерял бы всё введённое. Отправляем вручную, поля остаются как есть.
export function useKeepForm(fn: (state: FormState, fd: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(fn, undefined);
  const [, startTransition] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // submitter — чтобы до сервера дошло, какой кнопкой отправили («Сохранить» или «…и добавить ещё»)
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, onSubmit };
}

export function PendingButton({ pending, children, label = "Сохраняю…", className = "btn btn-red" }: {
  pending: boolean;
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <button className={className} disabled={pending}>
      {pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {pending ? label : children}
    </button>
  );
}
