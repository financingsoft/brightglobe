import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:locale(en|zh-CN)",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }
        ]
      },
      {
        source: "/:locale(en|zh-CN)/categories",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=900, stale-while-revalidate=1800" }
        ]
      },
      {
        source: "/:locale(en|zh-CN)/apps/:slug",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=1200" }]
      },
      {
        source: "/:locale(en|zh-CN)/apps/:slug/reviews",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=240" }]
      },
      {
        source: "/:locale(en|zh-CN)/search",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=120" }
        ]
      },
      {
        source: "/:locale(en|zh-CN)/account/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }]
      },
      {
        source: "/:locale(en|zh-CN)/library/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }]
      },
      {
        source: "/open/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }]
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }]
      }
    ];
  }
};

export default withNextIntl(nextConfig);
