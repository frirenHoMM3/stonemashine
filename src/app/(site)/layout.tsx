import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Metrika } from "@/components/Metrika";
import { getSettings } from "@/lib/settings";
import { abs } from "@/lib/site";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AutoPartsStore",
          name: s.shopName,
          url: abs("/"),
          description: s.tagline,
          ...(s.phone && { telephone: s.phone }),
          ...(s.address && { address: s.address }),
          ...(s.hours && { openingHours: s.hours }),
          sameAs: [s.avitoProfile, s.telegram && `https://t.me/${s.telegram}`].filter(Boolean),
        }}
      />
      <Header shopName={s.shopName} phone={s.phone} />
      <main>{children}</main>
      <Footer s={s} />
      <Metrika id={s.metrikaId} />
    </>
  );
}
