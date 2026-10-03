import type { NextConfig } from "next";

// Метрика: скрипт с yastatic/mc.yandex, отправка данных на mc.yandex.*. Inline нужен самому Next.js.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://mc.yandex.ru https://mc.yandex.com",
  "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Метатеги всегда сразу в <head>, а не стримом: так их гарантированно видят Яндекс, VK, Telegram-превью
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  async rewrites() {
    return [{ source: "/indexnow-:key.txt", destination: "/api/indexnow/:key" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default config;
