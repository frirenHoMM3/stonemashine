import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";

// Свой обработчик вместо robots.ts: нужен Clean-param для Яндекса
export function GET() {
  const body = [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /*?*q=",
    "Disallow: /*?*min=",
    "Disallow: /*?*max=",
    "Allow: /media/",
    "",
    "User-agent: Yandex",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /*?*q=",
    "Clean-param: sort&page&stock&min&max /catalog",
    "",
    `Sitemap: ${abs("/sitemap.xml")}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
