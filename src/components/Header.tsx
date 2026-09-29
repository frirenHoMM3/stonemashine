"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, IconMenu, IconPhone, Mark } from "./icons";

const NAV = [
  { href: "/catalog", label: "Каталог" },
  { href: "/#about", label: "О нас" },
  { href: "/#contacts", label: "Контакты" },
];

export function Header({ shopName, phone }: { shopName: string; phone: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled || open ? "border-line bg-ink/92 backdrop-blur-md" : "border-transparent bg-ink"
      }`}
    >
      <div className="wrap flex h-16 items-center gap-8">
        <Link href="/" className="group flex items-center gap-3" aria-label="На главную">
          <Mark className="h-7 w-7 transition-transform duration-300 group-hover:-rotate-6" />
          <span className="font-display text-[22px] font-extrabold uppercase tracking-[0.04em]">
            {shopName}
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-8 md:flex">
          {NAV.map((n) => {
            const active = n.href === "/catalog" && pathname.startsWith("/catalog");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group relative py-2 font-display text-[15px] font-bold uppercase tracking-[0.1em] transition-colors ${
                  active ? "text-bone" : "text-ash hover:text-bone"
                }`}
              >
                {n.label}
                <span
                  className={`absolute inset-x-0 -bottom-px h-[2px] origin-left bg-red transition-transform duration-300 ease-out-hard ${
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="hidden items-center gap-2 border-l border-line pl-8 font-mono text-sm text-bone hover:text-red-hot lg:flex"
          >
            <IconPhone className="text-red" />
            {phone}
          </a>
        )}

        <button
          className="ml-auto -mr-2 p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
        >
          {open ? <IconClose width={24} height={24} /> : <IconMenu width={24} height={24} />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-ink md:hidden">
          <nav className="wrap flex flex-col pt-4">
            {NAV.map((n, i) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="h-display animate-rise flex items-center justify-between border-b border-line py-5 text-5xl"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {n.label}
                <span className="font-mono text-xs text-red">0{i + 1}</span>
              </Link>
            ))}
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="mt-8 flex items-center gap-3 font-mono text-lg">
                <IconPhone className="text-red" /> {phone}
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
