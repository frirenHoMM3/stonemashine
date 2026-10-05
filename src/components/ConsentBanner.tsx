"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "sm_consent";
export type Consent = "all" | "necessary";

export function readConsent(): Consent | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=(all|necessary)`));
  return (m?.[1] as Consent) ?? null;
}

function write(v: Consent) {
  document.cookie = `${KEY}=${v}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new Event("sm-consent"));
}

// Клиент подписывается на согласие: Метрика грузится только после «Принять»
export function useConsent() {
  const [c, setC] = useState<Consent | null | undefined>(undefined);
  useEffect(() => {
    const sync = () => setC(readConsent());
    sync();
    window.addEventListener("sm-consent", sync);
    return () => window.removeEventListener("sm-consent", sync);
  }, []);
  return c;
}

export function ConsentBanner({ hasMetrika }: { hasMetrika: boolean }) {
  const c = useConsent();
  if (!hasMetrika || c !== null) return null;
  return (
    <div role="dialog" aria-label="Использование cookie" className="fixed inset-x-0 bottom-0 z-50 border-t border-red bg-coal/95 backdrop-blur-md [padding-bottom:env(safe-area-inset-bottom)]">
      <div className="wrap flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
        <p className="flex-1 text-sm leading-relaxed text-ash">
          Сайт использует cookie и сервис Яндекс.Метрика, чтобы понимать, как им пользуются. Без вашего согласия Метрика не запускается.{" "}
          <Link href="/privacy" className="text-bone underline decoration-red underline-offset-2">Подробнее</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => write("necessary")} className="btn btn-ghost btn-sm">Только необходимые</button>
          <button onClick={() => write("all")} className="btn btn-red btn-sm">Принять</button>
        </div>
      </div>
    </div>
  );
}

export function ConsentReset() {
  return (
    <button
      onClick={() => {
        document.cookie = `${KEY}=; Max-Age=0; Path=/`;
        location.reload();
      }}
      className="underline decoration-line-strong underline-offset-2 hover:text-bone"
    >
      Изменить выбор cookie
    </button>
  );
}
