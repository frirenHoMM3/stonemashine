"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Товары", match: (p: string) => p === "/admin" || p.startsWith("/admin/products") },
  { href: "/admin/categories", label: "Категории" },
  { href: "/admin/settings", label: "Настройки сайта" },
  { href: "/admin/account", label: "Аккаунт" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:py-4">
      {ITEMS.map((it) => {
        const active = it.match ? it.match(path) : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 font-display text-[15px] font-bold uppercase tracking-[0.08em] transition-colors ${
              active ? "bg-steel text-bone" : "text-ash hover:bg-steel/60 hover:text-bone"
            }`}
          >
            {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-red max-lg:inset-x-0 max-lg:top-auto max-lg:h-[2px] max-lg:w-auto" />}
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
