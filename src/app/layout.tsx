import type { Metadata, Viewport } from "next";
import { Fira_Sans_Extra_Condensed, Onest, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "STONEMACHINE — автозапчасти", template: "%s — STONEMACHINE" },
  description: "Автозапчасти в наличии. Проверенные детали, честное описание, покупка через Авито.",
};

export const viewport: Viewport = { themeColor: "#0a0a0b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
