import { getIndexNowKey } from "@/lib/indexnow";

// Файл-подтверждение ключа IndexNow. Снаружи доступен как /indexnow-<key>.txt (rewrite в next.config)
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-f0-9]{32}$/.test(key) || key !== (await getIndexNowKey())) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
