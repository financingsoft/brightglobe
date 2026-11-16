import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/en/", "/zh-CN/"],
      disallow: ["/open/", "/admin/", "/*/account/", "/*/library/", "/*/search"]
    },
    sitemap: "https://play.globeapps.com/sitemap.xml",
    host: "https://play.globeapps.com"
  };
}
