"use client";
import { saveCategory } from "@/app/admin/actions";
import { FormMessage, PendingButton, useKeepForm } from "./ui";

export function CategoryForm({ c }: { c?: { id: string; name: string; slug: string; sortOrder: number } }) {
  const { state, pending, onSubmit } = useKeepForm(saveCategory);
  return (
    // Новую категорию после успешного добавления очищаем пересозданием формы
    <form onSubmit={onSubmit} className="space-y-2" key={c ? c.id : state?.ok}>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input type="hidden" name="id" value={c?.id ?? ""} />
        <input name="name" defaultValue={c?.name} required placeholder="Название, например «Двигатель»" className="field h-10 flex-1" maxLength={60} />
        <input name="slug" defaultValue={c?.slug} placeholder="адрес (авто)" className="field h-10 w-full font-mono text-sm sm:w-44" />
        <input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} title="Порядок" className="field h-10 w-20 font-mono text-sm" />
        <PendingButton pending={pending} label="…" className={`btn btn-sm h-10 ${c ? "btn-ghost" : "btn-red"}`}>
          {c ? "Сохранить" : "Добавить"}
        </PendingButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
