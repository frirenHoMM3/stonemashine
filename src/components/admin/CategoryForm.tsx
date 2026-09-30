"use client";
import { saveCategory } from "@/app/admin/actions";
import { FormMessage, PendingButton, useKeepForm } from "./ui";

export function CategoryForm({ c }: { c?: { id: string; name: string } }) {
  const { state, pending, onSubmit } = useKeepForm(saveCategory);
  return (
    // Новую категорию после успешного добавления очищаем пересозданием формы
    <form onSubmit={onSubmit} className="min-w-0 flex-1 space-y-2" key={c ? c.id : state?.ok}>
      <div className="flex">
        <input type="hidden" name="id" value={c?.id ?? ""} />
        <input
          name="name"
          defaultValue={c?.name}
          required
          maxLength={60}
          placeholder="Например: Двигатель"
          className={`field h-10 min-w-0 flex-1 ${c ? "border-transparent bg-transparent font-display text-lg font-bold uppercase hover:border-line focus:bg-coal" : ""}`}
        />
        <PendingButton pending={pending} label="…" className={`btn btn-sm h-10 ${c ? "btn-ghost -ml-px" : "btn-red"}`}>
          {c ? "Сохранить" : "Добавить"}
        </PendingButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
