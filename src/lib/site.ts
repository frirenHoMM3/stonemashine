export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

// Поисковики не индексируют сайты на голом IP и localhost — пинговать их бессмысленно
export function isPublicDomain() {
  const host = new URL(SITE_URL).hostname;
  return host !== "localhost" && !/^[\d.]+$/.test(host) && !host.includes(":");
}
