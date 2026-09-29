import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="hazard mb-8 h-2 w-40" />
      <div className="h-display text-[9rem] leading-none text-red md:text-[14rem]">404</div>
      <p className="mt-4 font-display text-2xl font-bold uppercase tracking-[0.08em]">Такой детали нет</p>
      <p className="mt-2 text-sm text-ash">Возможно, её уже продали или ссылка устарела.</p>
      <Link href="/catalog" className="btn btn-red mt-8">В каталог</Link>
    </div>
  );
}
