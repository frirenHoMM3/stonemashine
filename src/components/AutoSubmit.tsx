"use client";
import { useEffect, useRef } from "react";

// Отправляет родительскую GET-форму при смене select/checkbox. Без JS форма работает по кнопке.
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const on = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.matches("select, input[type=checkbox]") && !t.hasAttribute("data-no-auto")) {
        if (t.getAttribute("name") === "make") {
          const model = form.querySelector<HTMLSelectElement>("select[name=model]");
          if (model) model.value = "";
        }
        form.requestSubmit();
      }
    };
    // Пустые поля не тащим в URL: /catalog?make=BMW вместо /catalog?q=&make=BMW&min=&max=…
    const clean = (e: FormDataEvent) => {
      for (const [k, v] of [...e.formData.entries()]) if (v === "") e.formData.delete(k);
    };
    form.addEventListener("change", on);
    form.addEventListener("formdata", clean);
    return () => {
      form.removeEventListener("change", on);
      form.removeEventListener("formdata", clean);
    };
  }, []);
  return <span ref={ref} hidden />;
}
