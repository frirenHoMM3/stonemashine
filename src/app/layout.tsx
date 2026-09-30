import type { Metadata, Viewport } from "next";
import { Fira_Sans_Extra_Condensed, Onest, JetBrains_Mono } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Fira_Sans_Extra_Condensed({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-fira-cond",
});
const sans = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest" });
const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-jb",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${s.shopName} — автозапчасти в наличии`, template: `%s — ${s.shopName}` },
    description: `${s.tagline}. Фото каждой детали, артикулы и OEM-номера, покупка через Авито.`,
    applicationName: s.shopName,
    openGraph: { type: "website", locale: "ru_RU", siteName: s.shopName },
    formatDetection: { telephone: false },
    verification: {
      yandex: s.yandexVerification || undefined,
      google: s.googleVerification || undefined,
    },
  };
}

export const viewport: Viewport = { themeColor: "#0a0a0b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
