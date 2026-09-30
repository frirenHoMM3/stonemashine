import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default config;
