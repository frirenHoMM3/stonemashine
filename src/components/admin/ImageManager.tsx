"use client";
import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/uploads-url";
import { IconDown, IconPlus, IconTrash, IconUp } from "../icons";

export type Img = { file: string; width: number; height: number };
type Pending = { id: string; name: string; preview: string; error?: string };

export function ImageManager({ initial, onBusyChange }: { initial: Img[]; onBusyChange: (busy: boolean) => void }) {
  const [images, setImages] = useState<Img[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    const items = list.map((f) => ({ id: crypto.randomUUID(), name: f.name, preview: URL.createObjectURL(f), file: f }));
    setPending((p) => [...p, ...items.map(({ file: _f, ...rest }) => rest)]);
    onBusyChange(true);

    // По 3 параллельно: быстро, но не душим сервер ресайзом
    const queue = [...items];
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        for (let it = queue.shift(); it; it = queue.shift()) {
          const fd = new FormData();
          fd.append("file", it.file);
          try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const json = await res.json().catch(() => ({ error: `Ошибка ${res.status}` }));
            if (!res.ok) throw new Error(json.error ?? `Ошибка ${res.status}`);
            setImages((imgs) => [...imgs, json as Img]);
            setPending((p) => p.filter((x) => x.id !== it!.id));
            URL.revokeObjectURL(it.preview);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Ошибка загрузки";
            setPending((p) => p.map((x) => (x.id === it!.id ? { ...x, error: msg } : x)));
          }
        }
      }),
    );
    onBusyChange(false);
  }

  const move = (from: number, to: number) =>
    setImages((imgs) => {
      if (to < 0 || to >= imgs.length) return imgs;
      const next = [...imgs];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });

  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <div
        onDragOver={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        className={`grid grid-cols-2 gap-2 border border-dashed p-2 transition-colors sm:grid-cols-3 xl:grid-cols-4 ${
          drag ? "border-red bg-red/5" : "border-line-strong"
        }`}
      >
        {images.map((img, i) => (
          <div
            key={img.file}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== i) {
                move(dragIndex, i);
                setDragIndex(i);
              }
            }}
            className={`group relative aspect-[4/3] cursor-grab overflow-hidden border bg-steel active:cursor-grabbing ${
              i === 0 ? "border-red" : "border-line"
            } ${dragIndex === i ? "opacity-40" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(img.file, "sm")} alt="" className="pointer-events-none h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-0 top-0 bg-red px-2 py-0.5 font-mono text-[10px] uppercase">Обложка</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-px bg-ink/85 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <Btn label="Левее" onClick={() => move(i, i - 1)} disabled={i === 0}><IconUp width={14} className="-rotate-90" /></Btn>
              <Btn label="Правее" onClick={() => move(i, i + 1)} disabled={i === images.length - 1}><IconDown width={14} className="-rotate-90" /></Btn>
              <Btn label="Удалить" onClick={() => setImages((imgs) => imgs.filter((_, k) => k !== i))} danger><IconTrash width={14} /></Btn>
            </div>
          </div>
        ))}

        {pending.map((p) => (
          <div key={p.id} className="relative aspect-[4/3] overflow-hidden border border-line bg-steel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
              {p.error ? (
                <>
                  <span className="text-xs text-red-hot">{p.error}</span>
                  <button type="button" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))} className="font-mono text-[10px] uppercase underline">
                    убрать
                  </button>
                </>
              ) : (
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-red border-r-transparent" />
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 border border-line bg-coal text-ash transition-colors hover:border-red hover:text-bone"
        >
          <IconPlus width={22} />
          <span className="font-mono text-[11px] uppercase tracking-wider">Добавить фото</span>
          <span className="text-[10px] text-smoke">или перетащите сюда</span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-smoke">
        Первое фото — обложка. Порядок меняется перетаскиванием. Фото сжимаются автоматически, геометки из них удаляются.
      </p>
    </div>
  );
}

function Btn({ children, onClick, label, disabled, danger }: {
  children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center disabled:opacity-25 ${danger ? "hover:bg-red" : "hover:bg-steel"}`}
    >
      {children}
    </button>
  );
}
