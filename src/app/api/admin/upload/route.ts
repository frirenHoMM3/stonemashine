import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, saveImage } from "@/lib/uploads";

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Сессия истекла, войдите заново" }, { status: 401 });

  // Кука SameSite=strict уже режет CSRF, но проверим Origin и тут
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  if (!hit(`upload:${admin.id}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "Слишком много загрузок подряд" }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Нет файла" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Файл больше 15 МБ" }, { status: 413 });

  try {
    const saved = await saveImage(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: `«${file.name}» — не похоже на изображение` }, { status: 415 });
  }
}
