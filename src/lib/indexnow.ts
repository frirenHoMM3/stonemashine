import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { abs, isPublicDomain } from "./site";

export async function getIndexNowKey() {
  const row = await db.setting.findUnique({ where: { key: "indexnowKey" } });
  if (row) return row.value;
  const value = randomBytes(16).toString("hex");
  await db.setting.upsert({ where: { key: "indexnowKey" }, create: { key: "indexnowKey", value }, update: {} });
  return (await db.setting.findUnique({ where: { key: "indexnowKey" } }))!.value;
}

// Сообщаем Яндексу/Bing, что страницы изменились — переобход за часы, а не недели.
// Не блокирует сохранение и молча ничего не делает, пока сайт на голом IP.
export function pingIndexNow(paths: string[]) {
  if (!isPublicDomain() || !paths.length) return;
  void (async () => {
    try {
      const key = await getIndexNowKey();
      await fetch("https://yandex.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: new URL(abs("/")).host,
          key,
          keyLocation: abs(`/indexnow-${key}.txt`),
          urlList: paths.map(abs),
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // Сеть/поисковик недоступны — не страшно, есть sitemap
    }
  })();
}
