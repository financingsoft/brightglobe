import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "categoriesPage" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: `/${locale}/categories` }
  };
}

export default async function CategoriesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const categories = [
    ["productivity", "✦"],
    ["creativity", "◈"],
    ["education", "⌘"],
    ["finance", "↗"],
    ["health", "✚"],
    ["games", "◇"],
    ["utilities", "⌁"],
    ["entertainment", "♫"]
  ] as const;

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="container" style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <Link className="brand" href="/"><span className="brand-mark">G</span><span>Globe Play</span></Link>
          <nav className="nav"><Link href="/">{t("nav.explore")}</Link><Link href="/categories">{t("nav.categories")}</Link></nav>
          <div className="nav-right"><Link className="locale-link" href="/categories" locale={locale === "en" ? "zh-CN" : "en"}>{locale === "en" ? "中文" : "English"}</Link></div>
        </div>
      </header>
      <section className="page-heading">
        <div className="container">
          <div className="eyebrow"><span className="eyebrow-dot" />{t("categories.eyebrow")}</div>
          <h1>{t("categoriesPage.title")}</h1>
          <p className="section-copy">{t("categoriesPage.description")}</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="category-grid">
            {categories.map(([key, icon]) => (
              <article className="category-card" key={key}>
                <span className="category-icon" aria-hidden="true">{icon}</span>
                <strong>{t(`categories.${key}`)}</strong>
                <span className="category-arrow" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
          <p className="trust-line" style={{ marginTop: 24 }}>
            {locale === "en" ? "App listings will appear here after publisher onboarding and review." : "开发者入驻和应用审核完成后，这里将展示正式应用目录。"}
          </p>
        </div>
      </section>
    </main>
  );
}
