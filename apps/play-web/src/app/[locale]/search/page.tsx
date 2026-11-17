import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/search` }
  };
}

export default async function SearchPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("search");

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="container" style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <Link className="brand" href="/"><span className="brand-mark">G</span><span>Globe Play</span></Link>
          <div className="nav-right"><Link className="locale-link" href="/search" locale={locale === "en" ? "zh-CN" : "en"}>{locale === "en" ? "中文" : "English"}</Link></div>
        </div>
      </header>
      <section className="page-heading">
        <div className="container">
          <div className="eyebrow"><span className="eyebrow-dot" />Globe Play</div>
          <h1>{t("title")}</h1>
          <p className="section-copy">{t("description")}</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <form className="search-form" action={`/${locale}/search`} method="get">
            <input type="search" name="q" placeholder={t("placeholder")} aria-label={t("placeholder")} />
            <button className="primary-link" type="submit">{t("action")}</button>
          </form>
          <div className="empty-state" style={{ marginTop: 24 }}>
            {t("note")}
          </div>
        </div>
      </section>
    </main>
  );
}
