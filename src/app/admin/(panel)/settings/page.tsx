import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { abs, isPublicDomain } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { CopyButton } from "@/components/CopyButton";

export const metadata = { title: "Настройки сайта" };

export default async function SettingsPage() {
  const values = await getSettings();
  const domain = isPublicDomain();
  const links = [
    ["Карта сайта", abs("/sitemap.xml")],
    ["robots.txt", abs("/robots.txt")],
  ];

  return (
    <div className="grid max-w-5xl gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="h-display mb-8 text-4xl sm:text-5xl">Настройки</h1>
        <SettingsForm values={values} labels={SETTING_KEYS} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
        <div className="border border-line bg-coal p-5">
          <div className="label mb-3">Для вебмастера</div>
          <ul className="space-y-3">
            {links.map(([k, v]) => (
              <li key={k}>
                <div className="flex items-center justify-between text-sm">
                  {k} <CopyButton value={v} />
                </div>
                <a href={v} target="_blank" className="block break-all font-mono text-xs text-ash hover:text-bone">{v}</a>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ash">
            Карта обновляется сама: новая карточка появляется в ней сразу после сохранения.
          </div>
        </div>
        <div className={`border p-5 text-xs leading-relaxed ${domain ? "border-ok/40 text-ash" : "border-line text-smoke"}`}>
          <div className={`label mb-2 ${domain ? "!text-ok" : ""}`}>IndexNow {domain ? "· включён" : "· ждёт домен"}</div>
          {domain
            ? "При сохранении, скрытии и удалении карточки Яндекс получает уведомление и переобходит страницу."
            : "Сайт пока на IP — поисковики такие не индексируют. Как только появится домен, уведомления Яндексу включатся сами."}
        </div>
      </aside>
    </div>
  );
}
