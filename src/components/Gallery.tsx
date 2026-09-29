"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/uploads-url";
import { IconChevron, IconClose } from "./icons";

type Img = { file: string; width: number; height: number };

export function Gallery({ images, title }: { images: Img[]; title: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = images.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);

  useEffect(() => {
    if (!zoom) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", on);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", on);
    };
  }, [zoom, go]);

  if (!n) {
    return (
      <div className="grid-bg flex aspect-[4/3] items-center justify-center border border-line bg-coal">
        <span className="label">Фото скоро появятся</span>
      </div>
    );
  }

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current == null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      touchX.current = null;
    },
  };

  return (
    <div>
      <div className="group relative aspect-[4/3] overflow-hidden border border-line bg-steel" {...swipe}>
        {images.map((img, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.file}
            src={mediaUrl(img.file, "lg")}
            alt={`${title} — фото ${k + 1}`}
            width={img.width}
            height={img.height}
            loading={k === 0 ? "eager" : "lazy"}
            onClick={() => setZoom(true)}
            className={`absolute inset-0 h-full w-full cursor-zoom-in object-contain transition-opacity duration-500 ${
              k === i ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}
        {n > 1 && (
          <>
            <Arrow dir={-1} onClick={() => go(-1)} className="left-0 opacity-0 group-hover:opacity-100" />
            <Arrow dir={1} onClick={() => go(1)} className="right-0 opacity-0 group-hover:opacity-100" />
            <div className="absolute bottom-0 right-0 bg-ink/85 px-3 py-1.5 font-mono text-xs tabular-nums">
              {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </div>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((img, k) => (
            <button
              key={img.file}
              onClick={() => setI(k)}
              aria-label={`Фото ${k + 1}`}
              className={`relative aspect-square overflow-hidden border bg-steel transition-colors ${
                k === i ? "border-red" : "border-line hover:border-line-strong"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(img.file, "sm")} alt="" loading="lazy" className={`h-full w-full object-cover transition-opacity ${k === i ? "" : "opacity-60 hover:opacity-100"}`} />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div className="animate-rise fixed inset-0 z-50 flex items-center justify-center bg-ink/97 [animation-duration:.3s]" onClick={() => setZoom(false)} {...swipe}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(images[i].file, "lg")} alt={title} className="max-h-[92vh] max-w-[96vw] object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center border border-line-strong bg-ink hover:border-red" aria-label="Закрыть">
            <IconClose />
          </button>
          {n > 1 && (
            <>
              <Arrow dir={-1} onClick={(e) => { e.stopPropagation(); go(-1); }} className="left-2" />
              <Arrow dir={1} onClick={(e) => { e.stopPropagation(); go(1); }} className="right-2" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Arrow({ dir, onClick, className }: { dir: 1 | -1; onClick: (e: React.MouseEvent) => void; className: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir > 0 ? "Следующее фото" : "Предыдущее фото"}
      className={`absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-ink/80 transition-all hover:bg-red ${className}`}
    >
      <IconChevron className={dir < 0 ? "rotate-180" : ""} />
    </button>
  );
}
