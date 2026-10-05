import { z } from "zod";
import { db } from "@/lib/db";
import { hit } from "@/lib/rate-limit";

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|monitor|curl|wget|python|go-http/i;
const PATH = /^\/(catalog(\/[a-z0-9-]{1,120})?|privacy)?$/;

const body = z.object({
  kind: z.enum(["view", "avito", "phone", "tg", "wa"]),
  path: z.string().max(200),
  ref: z.string().max(300).optional(),
});

const device = (ua: string) => (/ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop");

// Анонимный счётчик. IP используется только для лимита запросов в памяти и нигде не сохраняется,
// user-agent — только чтобы отбросить ботов и определить тип устройства, тоже не сохраняется.
export async function POST(req: Request) {
  const done = () => new Response(null, { status: 204 });
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin");
  if (!origin || !host || new URL(origin).host !== host) return new Response(null, { status: 403 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!hit(`collect:${ip}`, 120, 60_000).ok) return new Response(null, { status: 429 });

  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return done();

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { kind, ref } = parsed.data;
  const path = parsed.data.path.split(/[?#]/)[0].replace(/(.)\/+$/, "$1");
  if (!PATH.test(path)) return done();

  let refHost: string | null = null;
  try {
    if (ref) refHost = new URL(ref).hostname.replace(/^(www|m)\./, "").slice(0, 100);
  } catch {}
  if (refHost && refHost === host.split(":")[0].replace(/^www\./, "")) refHost = null;

  await db.hit.create({ data: { kind, path, ref: kind === "view" ? refHost : null, device: device(ua) } });

  // Хранение ограничено: раз в ~200 запросов чистим записи старше 14 месяцев
  if (Math.random() < 0.005) {
    await db.hit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 425 * 864e5) } } }).catch(() => {});
  }
  return done();
}
