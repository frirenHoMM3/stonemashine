import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Первый рубеж: без валидной подписи в админку не пускаем вообще.
// Второй рубеж (сверка с БД) — requireAdmin() в каждой странице и action.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // За nginx nextUrl содержит внутренний адрес (127.0.0.1:3000) — берём публичный из заголовков прокси.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return NextResponse.redirect(new URL("/admin/login", `${proto}://${host}`));
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
