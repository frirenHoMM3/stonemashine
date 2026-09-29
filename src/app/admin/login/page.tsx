import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { Mark } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Вход" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <div className="grid-bg flex min-h-screen items-center justify-center px-4">
      <div className="animate-rise w-full max-w-sm">
        <div className="hazard h-1.5" />
        <div className="border border-t-0 border-line bg-ink p-8">
          <div className="flex items-center gap-3">
            <Mark className="h-8 w-8" />
            <div>
              <div className="font-display text-xl font-extrabold uppercase leading-none tracking-[0.04em]">Панель управления</div>
              <div className="label mt-1">Доступ ограничен</div>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
