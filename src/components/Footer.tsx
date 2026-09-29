import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { Mark } from "./icons";

export function Footer({ s }: { s: Settings }) {
  return (
    <footer className="mt-32 border-t border-line">
      <div className="hazard h-1.5 opacity-80" />
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Mark className="h-8 w-8" />
            <span className="font-display text-2xl font-extrabold uppercase tracking-[0.04em]">{s.shopName}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ash">{s.tagline}</p>
        </div>
        <div>
          <div className="label mb-4">Навигация</div>
          <ul className="space-y-2 text-sm">
            <li><Link className="text-ash hover:text-bone" href="/catalog">Каталог</Link></li>
            <li><Link className="text-ash hover:text-bone" href="/#about">О нас</Link></li>
            <li><Link className="text-ash hover:text-bone" href="/#contacts">Контакты</Link></li>
            {s.avitoProfile && (
              <li><a className="text-ash hover:text-bone" href={s.avitoProfile} target="_blank" rel="noopener noreferrer">Мы на Авито ↗</a></li>
            )}
          </ul>
        </div>
        <div>
          <div className="label mb-4">Связь</div>
          <ul className="space-y-2 font-mono text-sm">
            {s.phone && <li><a className="hover:text-red-hot" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a></li>}
            {s.telegram && <li><a className="hover:text-red-hot" href={`https://t.me/${s.telegram}`} target="_blank" rel="noopener noreferrer">@{s.telegram}</a></li>}
            {s.address && <li className="text-ash">{s.address}</li>}
            {s.hours && <li className="text-ash">{s.hours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap flex h-14 items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-smoke">
          <span>© {new Date().getFullYear()} {s.shopName}</span>
          <span>Продажа через Авито</span>
        </div>
      </div>
    </footer>
  );
}
