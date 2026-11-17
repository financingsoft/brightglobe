import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import "../globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play.globeapps.com";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  if (!hasLocale(routing.locales, requestedLocale)) return {};
  const locale = requestedLocale as AppLocale;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("title"), template: "%s | Globe Play" },
    description: t("description"),
    applicationName: "Globe Play",
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        "zh-CN": "/zh-CN",
        "x-default": "/en"
      }
    },
    openGraph: {
      type: "website",
      siteName: "Globe Play",
      title: t("title"),
      description: t("description"),
      url: `/${locale}`,
      locale: locale === "zh-CN" ? "zh_CN" : "en_US"
    },
    robots: { index: true, follow: true }
  };
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
