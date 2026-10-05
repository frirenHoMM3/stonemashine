import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Статистика" };
export const dynamic = "force-dynamic";

const PERIODS = [
  { d: 7, label: "7 дней" },
  { d: 30, label: "30 дней" },
  { d: 90, label: "90 дней" },
];
const KIND_LABEL: Record<string, string> = { avito: "Клики на Авито", phone: "Звонки", tg: "Telegram", wa: "WhatsApp" };
const DEVICE_LABEL: Record<string, string> = { mobile: "Телефон", desktop: "Компьютер", tablet: "Планшет" };

export default async function Stats({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p.d) === sp.d)?.d ?? 30;
  const since = new Date(Date.now() - days * 864e5);
  const where = { createdAt: { gte: since } };

  const [s, byKind, daily, pages, refs, devices] = await Promise.all([
    getSettings(),
    db.hit.groupBy({ by: ["kind"], where, _count: true }),
    db.$queryRaw<{ day: string; views: bigint; clicks: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'Europe/Moscow')::date, 'YYYY-MM-DD') AS day,
             count(*) FILTER (WHERE kind = 'view') AS views,
             count(*) FILTER (WHERE kind <> 'view') AS clicks
      FROM "Hit" WHERE "createdAt" >= ${since} GROUP BY 1`,
    db.hit.groupBy({ by: ["path"], where: { ...where, kind: "view" }, _count: true, orderBy: { _count: { path: "desc" } }, take: 10 }),
    db.hit.groupBy({ by: ["ref"], where: { ...where, kind: "view", ref: { not: null } }, _count: true, orderBy: { _count: { ref: "desc" } }, take: 8 }),
    db.hit.groupBy({ by: ["device"], where: { ...where, kind: "view" }, _count: true }),
  ]);

  const slugs = pages.filter((p) => p.path.startsWith("/catalog/")).map((p) => p.path.slice(9));
  const titles = new Map(
    (await db.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true } })).map((p) => [p.slug, p.title]),
  );
  const pageName = (path: string) =>
    path === "/" ? "Главная" : path === "/catalog" ? "Каталог" : path === "/privacy" ? "Политика" : titles.get(path.slice(9)) ?? path;

  const count = (k: string) => byKind.find((x) => x.kind === k)?._count ?? 0;
  const views = count("view");
  const clicks = byKind.filter((x) => x.kind !== "view").reduce((a, x) => a + x._count, 0);

  // Ряд по дням без пропусков (по Москве)
  const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  const map = new Map(daily.map((r) => [r.day, r]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = fmt(new Date(Date.now() - (days - 1 - i) * 864e5));
    const r = map.get(day);
    return { day, views: Number(r?.views ?? 0), clicks: Number(r?.clicks ?? 0) };
  });
  const max = Math.max(1, ...series.map((x) => x.views));
  const devTotal = devices.reduce((a, x) => a + x._count, 0) || 1;

  const tiles = [
    { n: views, label: "просмотров" },
    { n: clicks, label: "переходов к покупке" },
    { n: views ? Math.round((clicks / views) * 1000) / 10 : 0, label: "% кликов" },
    { n: count("avito"), label: "на Авито" },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="h-display text-4xl sm:text-5xl">Статистика</h1>
        <div className="flex gap-px bg-line">
          {PERIODS.map((p) => (
            <Link key={p.d} href={`/admin/stats?d=${p.d}`} className={`px-4 py-2 font-display text-sm font-bold uppercase tracking-wider ${p.d === days ? "bg-red" : "bg-ink text-ash hover:text-bone"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-ink p-5">
            <div className="font-display text-4xl font-bold tabular-nums sm:text-5xl">{t.n.toLocaleString("ru-RU")}</div>
            <div className="label mt-1">{t.label}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl font-bold uppercase">Просмотры по дням</h2>
        <div className="flex h-40 items-end gap-px border-b border-line">
          {series.map((x) => (
            <div key={x.day} className="group relative flex-1" title={`${x.day}: ${x.views} просм., ${x.clicks} кликов`}>
              <div className="bg-red/80 transition-colors group-hover:bg-red-hot" style={{ height: `${(x.views / max) * 140}px`, minHeight: x.views ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-smoke">
          <span>{series[0].day}</span>
          <span>макс. {max} в день</span>
          <span>{series[series.length - 1].day}</span>
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <Block title="Популярные страницы" empty={!pages.length}>
          {pages.map((p) => <Row key={p.path} name={pageName(p.path)} n={p._count} />)}
        </Block>
        <Block title="Откуда приходят" empty={!refs.length} note="Прямые заходы не учитываются">
          {refs.map((r) => <Row key={r.ref} name={r.ref!} n={r._count} />)}
        </Block>
        <Block title="Действия" empty={!clicks}>
          {Object.entries(KIND_LABEL).map(([k, name]) => count(k) > 0 && <Row key={k} name={name} n={count(k)} />)}
        </Block>
        <Block title="Устройства" empty={!devices.length}>
          {devices.sort((a, b) => b._count - a._count).map((d) => (
            <Row key={d.device} name={DEVICE_LABEL[d.device] ?? d.device} n={d._count} extra={`${Math.round((d._count / devTotal) * 100)}%`} />
          ))}
        </Block>
      </div>

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-smoke">
        Собственный счётчик: без cookie и IP, боты отсеиваются, записи старше 14 месяцев удаляются.
        {/^\d+$/.test(s.metrikaId)
          ? " Яндекс.Метрика запускается только у посетителей, принявших cookie, поэтому её цифры меньше."
          : " Яндекс.Метрика не подключена — номер счётчика указывается в настройках."}
      </p>
    </div>
  );
}

function Block({ title, note, empty, children }: { title: string; note?: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 font-display text-xl font-bold uppercase">{title}{note && <span className="ml-3 text-xs font-normal normal-case text-smoke">{note}</span>}</h2>
      {empty ? <div className="border border-line p-4 text-sm text-smoke">Пока нет данных</div> : <ul className="divide-y divide-line border-y border-line">{children}</ul>}
    </section>
  );
}

function Row({ name, n, extra }: { name: string; n: number; extra?: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {extra && <span className="font-mono text-xs text-smoke">{extra}</span>}
      <span className="font-display font-bold tabular-nums">{n.toLocaleString("ru-RU")}</span>
    </li>
  );
}
