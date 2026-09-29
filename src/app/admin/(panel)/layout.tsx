import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { Mark, IconExternal } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 z-30 flex flex-col border-b border-line bg-coal lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 border-line px-5 lg:border-b">
          <Mark className="h-7 w-7" />
          <span className="font-display text-lg font-extrabold uppercase tracking-[0.04em]">Админка</span>
          <Link href="/" target="_blank" className="ml-auto text-ash hover:text-bone" title="Открыть сайт">
            <IconExternal width={16} />
          </Link>
        </div>
        <AdminNav />
        <div className="mt-auto hidden border-t border-line p-5 lg:block">
          <div className="label">Вы вошли как</div>
          <div className="mt-1 truncate font-mono text-sm">{admin.username}</div>
          <form action={logout} className="mt-4">
            <button className="btn btn-ghost btn-sm w-full">Выйти</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</div>
    </div>
  );
}
