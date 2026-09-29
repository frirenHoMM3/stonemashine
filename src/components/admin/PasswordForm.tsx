"use client";
import { changePassword } from "@/app/admin/actions";
import { Field, FormMessage, PendingButton, useKeepForm } from "./ui";

export function PasswordForm() {
  const { state, pending, onSubmit } = useKeepForm(changePassword);
  return (
    <form onSubmit={onSubmit} className="space-y-4" key={state?.ok}>
      <Field label="Текущий пароль">
        <input name="current" type="password" autoComplete="current-password" required className="field" />
      </Field>
      <Field label="Новый пароль" hint="Минимум 10 символов">
        <input name="next" type="password" autoComplete="new-password" required minLength={10} className="field" />
      </Field>
      <Field label="Повторите новый">
        <input name="repeat" type="password" autoComplete="new-password" required className="field" />
      </Field>
      <FormMessage state={state} />
      <PendingButton pending={pending}>Сменить пароль</PendingButton>
    </form>
  );
}
