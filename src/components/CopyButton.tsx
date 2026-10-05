"use client";
import { useState } from "react";

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className={`font-mono text-[10px] uppercase tracking-wider transition-colors ${done ? "text-ok" : "text-smoke hover:text-bone"} ${className}`}
    >
      {done ? "✓ скопировано" : "копировать"}
    </button>
  );
}
