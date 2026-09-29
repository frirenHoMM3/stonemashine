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
    form.addEventListener("change", on);
    return () => form.removeEventListener("change", on);
  }, []);
  return <span ref={ref} hidden />;
}
