"use client";
import { useEffect, useRef } from "react";

// Одна обёртка на секцию: дети с data-reveal появляются по очереди, когда секция въезжает в экран.
export function Reveal({ children, className, as: Tag = "div", step = 70 }: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul";
  step?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const targets = items.length ? items : [root];
    const vh = window.innerHeight;
    const hidden = targets.filter((el) => el.getBoundingClientRect().top > vh * 0.92);
    hidden.forEach((el) => el.classList.add("reveal-pending"));
    if (!hidden.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        let i = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.setProperty("--d", `${i++ * step}ms`);
          el.classList.replace("reveal-pending", "reveal-in");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    hidden.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [step]);

  return <Tag ref={ref as never} className={className}>{children}</Tag>;
}
