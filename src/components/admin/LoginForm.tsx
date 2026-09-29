"use client";
import { useActionState } from "react";
import { login } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "./ui";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      <FormMessage state={state} />
      <label className="block">
        <span className="label mb-2 block">Логин</span>
        <input name="username" autoComplete="username" required autoFocus className="field" />
      </label>
      <label className="block">
        <span className="label mb-2 block">Пароль</span>
        <input name="password" type="password" autoComplete="current-password" required className="field" />
      </label>
      <SubmitButton pending="Проверяю…" className="btn btn-red mt-2 w-full">Войти</SubmitButton>
    </form>
  );
}
