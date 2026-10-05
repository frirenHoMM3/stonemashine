import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Политика конфиденциальности" };
export const dynamic = "force-dynamic";

export default async function Privacy() {
  const s = await getSettings();
  const who = s.operatorName || "Владелец сайта";
  const metrika = /^\d+$/.test(s.metrikaId);
  return (
    <div className="wrap max-w-3xl pt-10">
      <h1 className="h-display text-4xl sm:text-5xl">Политика конфиденциальности</h1>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-bone/85 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:text-bone [&_li]:ml-5 [&_li]:list-disc">
        <section>
          <h2>Кто мы</h2>
          <p>
            Оператор сайта — {who}{s.operatorInn && `, ${s.operatorInn}`}.
            {s.operatorEmail && <> Связь по вопросам данных: <a className="text-red-hot underline" href={`mailto:${s.operatorEmail}`}>{s.operatorEmail}</a>.</>}
          </p>
          <p className="mt-2">Сайт — витрина: оформление заказа и оплата происходят на стороннем сервисе (Авито) по его правилам. Мы не просим регистрироваться и не собираем формы с личными данными.</p>
        </section>
        <section>
          <h2>Что собираем</h2>
          <ul className="space-y-1">
            <li><b>Анонимная статистика посещений</b>: открытая страница, тип устройства, сайт-источник перехода, клики по кнопкам «Купить», телефону и мессенджерам. IP-адрес, cookie и иные идентификаторы не сохраняются, определить по этим данным конкретного человека нельзя.</li>
            {metrika && <li><b>Яндекс.Метрика</b> — только если вы нажали «Принять» в плашке. Сервис использует cookie и обрабатывает IP-адрес, данные о браузере и действиях на сайте по собственной <a className="text-red-hot underline" href="https://yandex.ru/legal/confidential/" target="_blank" rel="noopener noreferrer">политике</a>. Запись сессий (Вебвизор) отключена.</li>}
            <li><b>Cookie согласия</b> {metrika && "(sm_consent) "}— запоминает ваш выбор на 12 месяцев.</li>
          </ul>
        </section>
        <section>
          <h2>Зачем</h2>
          <p>Чтобы понимать, какие запчасти интересны посетителям, и улучшать сайт. Данные не продаются и не передаются третьим лицам, кроме перечисленных сервисов.</p>
        </section>
        <section>
          <h2>Ваши права</h2>
          <p>
            Вы можете в любой момент отозвать согласие (ссылка «Изменить выбор cookie» внизу страницы), запросить сведения о своих данных или их удаление{s.operatorEmail && <>, написав на {s.operatorEmail}</>}.
            Также вы вправе обратиться в Роскомнадзор.
          </p>
        </section>
        <p className="text-sm text-smoke">Редакция от 03.10.2026. <Link href="/" className="underline">На главную</Link></p>
      </div>
    </div>
  );
}
