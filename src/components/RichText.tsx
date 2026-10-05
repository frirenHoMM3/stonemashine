import { Fragment } from "react";

// Простая разметка для описаний из админки. Рендерим React-элементами, а не HTML,
// поэтому что бы ни вставили в текст — выполниться как код оно не сможет.
//   - пункт / • пункт / * пункт  → список
//   1. пункт                      → нумерованный список
//   **жирный**, ссылки https://…  → как ожидается
//   пустая строка                 → новый абзац

const INLINE = /(\*\*[^*]+\*\*|https?:\/\/[^\s<>()]+[^\s<>().,;:!?"'»])/g;

function inline(text: string) {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i} className="font-semibold text-bone">{part.slice(2, -2)}</strong>;
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-red-hot underline decoration-red/40 underline-offset-2 hover:decoration-red-hot">
          {part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const ul = /^\s*[-•*—]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = out[out.length - 1];
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const item = (ul ?? ol)![1];
      if (last?.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else if (!line.trim()) {
      out.push({ kind: "p", lines: [] });
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      out.push({ kind: "p", lines: [line] });
    }
  }
  return out.filter((b) => (b.kind === "p" ? b.lines.length : b.items.length));
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 text-[15px] leading-relaxed text-bone/85 ${className}`}>
      {blocks(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            {b.lines.map((l, k) => (
              <Fragment key={k}>
                {k > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ) : b.kind === "ul" ? (
          <ul key={i} className="space-y-1.5">
            {b.items.map((it, k) => (
              <li key={k} className="relative pl-5 before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:bg-red">
                {inline(it)}
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="space-y-1.5">
            {b.items.map((it, k) => (
              <li key={k} className="flex gap-3">
                <span className="w-5 shrink-0 text-right font-mono text-sm text-red">{k + 1}.</span>
                <span>{inline(it)}</span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
