"use client";
import Script from "next/script";
import { useConsent } from "./ConsentBanner";

// Метрика ставит cookie и получает IP посетителя — запускаем только после согласия.
// Вебвизор (запись действий на странице) выключен намеренно: для него нужно отдельное, более строгое согласие.
export function Metrika({ id }: { id: string }) {
  const consent = useConsent();
  if (!/^\d+$/.test(id) || consent !== "all") return null;
  return (
    <Script id="ym" strategy="afterInteractive">{`
      (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
      (window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
      ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});
    `}</Script>
  );
}
