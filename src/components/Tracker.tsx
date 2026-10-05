"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

function send(kind: string, ref?: string) {
  const data = JSON.stringify({ kind, path: location.pathname, ...(ref ? { ref } : {}) });
  try {
    if (!navigator.sendBeacon?.("/api/collect", new Blob([data], { type: "application/json" }))) throw 0;
  } catch {
    fetch("/api/collect", { method: "POST", body: data, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

// Анонимная статистика без кук и без хранения чего-либо в браузере посетителя
export function Tracker() {
  const path = usePathname();

  useEffect(() => {
    // внутри сайта реферер — предыдущая страница, он не интересен
    send("view", document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : undefined);
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const h = a.href;
      if (h.startsWith("tel:")) send("phone");
      else if (h.startsWith("https://t.me/")) send("tg");
      else if (h.startsWith("https://wa.me/")) send("wa");
      else if (a.hostname.endsWith("avito.ru")) send("avito");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
