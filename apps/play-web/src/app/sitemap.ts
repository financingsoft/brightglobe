import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play.globeapps.com";
const locales = ["en", "zh-CN"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = ["", "/categories"];
  return locales.flatMap((locale) =>
    publicPaths.map((path) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date("2026-11-17T00:00:00.000Z"),
      changeFrequency: path === "" ? "daily" as const : "weekly" as const,
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: {
          en: `${baseUrl}/en${path}`,
          "zh-CN": `${baseUrl}/zh-CN${path}`
        }
      }
    }))
  );
}
