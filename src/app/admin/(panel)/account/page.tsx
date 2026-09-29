import { requireAdmin } from "@/lib/auth";
import { logout, logoutEverywhere } from "../../actions";
import { PasswordForm } from "@/components/admin/PasswordForm";

export const metadata = { title: "Аккаунт" };

export default async function Account() {
  const admin = await requireAdmin();
  return (
    <div className="max-w-xl">
      <div className="label">Доступ</div>
      <h1 className="h-display mt-2 text-5xl">Аккаунт</h1>
      <dl className="mt-6 space-y-1 font-mono text-sm">
        <div><span className="text-smoke">логин:</span> {admin.username}</div>
        <div><span className="text-smoke">последний вход:</span> {admin.lastLoginAt?.toLocaleString("ru-RU") ?? "—"}</div>
      </dl>

      <h2 className="mt-12 mb-5 border-b border-line pb-3 font-display text-2xl font-bold uppercase">Смена пароля</h2>
      <PasswordForm />

      <h2 className="mt-12 mb-5 border-b border-line pb-3 font-display text-2xl font-bold uppercase">Сессии</h2>
      <p className="mb-4 text-sm text-ash">Если заходили с чужого устройства — завершите все сессии, включая эту.</p>
      <div className="flex flex-wrap gap-2">
        <form action={logout}><button className="btn btn-ghost">Выйти</button></form>
        <form action={logoutEverywhere}><button className="btn btn-ghost hover:!border-red">Выйти на всех устройствах</button></form>
      </div>
    </div>
  );
}
