import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Настройки сайта" };

export default async function SettingsPage() {
  const values = await getSettings();
  return (
    <div className="max-w-2xl">
      <div className="label">Сайт</div>
      <h1 className="h-display mt-2 mb-10 text-5xl">Настройки</h1>
      <SettingsForm values={values} labels={SETTING_KEYS} />
    </div>
  );
}
