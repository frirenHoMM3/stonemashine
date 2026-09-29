import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <Header shopName={s.shopName} phone={s.phone} />
      <main>{children}</main>
      <Footer s={s} />
    </>
  );
}
