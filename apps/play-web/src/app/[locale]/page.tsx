import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("title"), description: t("description") };
}

const categories = [
  { key: "productivity", icon: "✦" },
  { key: "creativity", icon: "◈" },
  { key: "education", icon: "⌘" },
  { key: "finance", icon: "↗" },
  { key: "health", icon: "✚" },
  { key: "games", icon: "◇" },
  { key: "utilities", icon: "⌁" },
  { key: "entertainment", icon: "♫" }
] as const;

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Globe Play",
    url: "https://play.globeapps.com",
    description: t("metadata.description")
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Globe Play",
    url: "https://play.globeapps.com",
    inLanguage: locale
  };

  return (
    <div className="site-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="topbar">
        <div className="container" style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">G</span>
            <span>Globe Play</span>
          </Link>
          <nav className="nav" aria-label="Main navigation">
            <Link href="/">{t("nav.explore")}</Link>
            <Link href="/categories">{t("nav.categories")}</Link>
            <a href="https://open.globeapps.com">{t("nav.developers")}</a>
          </nav>
          <div className="nav-right">
            <Link className="locale-link" href="/" locale={locale === "en" ? "zh-CN" : "en"}>
              {locale === "en" ? "中文" : "English"}
            </Link>
            <Link className="primary-link" href="/search">{t("nav.search")} <span aria-hidden="true">⌕</span></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" />{t("hero.eyebrow")}</div>
              <h1>{t("hero.title")}</h1>
              <p className="hero-copy">{t("hero.description")}</p>
              <form className="search-form" action={`/${locale}/search`} method="get">
                <span aria-hidden="true" style={{ color: "#98a2b3", paddingLeft: 12 }}>⌕</span>
                <input name="q" type="search" placeholder={t("hero.searchPlaceholder")} aria-label={t("hero.searchPlaceholder")} />
                <button className="primary-link" type="submit">{t("hero.searchAction")}</button>
              </form>
              <p className="trust-line">{t("hero.trust")}</p>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit one" />
              <div className="orbit two" />
              <div className="orbit three" />
              <div className="globe-core" />
              <div className="float-card float-one">
                <span className="float-icon">✓</span>
                <span><strong>Publisher clarity</strong><small>Know who made it</small></span>
              </div>
              <div className="float-card float-two">
                <span className="float-icon">↗</span>
                <span><strong>Version history</strong><small>Understand every update</small></span>
              </div>
              <div className="float-card float-three">
                <span className="float-icon">◎</span>
                <span><strong>Real experiences</strong><small>Useful community insight</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow"><span className="eyebrow-dot" />{t("categories.eyebrow")}</div>
              <h2>{t("categories.title")}</h2>
              <p className="section-copy">{t("categories.description")}</p>
            </div>
            <div className="category-grid">
              {categories.map((category) => (
                <Link className="category-card" href="/categories" key={category.key}>
                  <span className="category-icon" aria-hidden="true">{category.icon}</span>
                  <strong>{t(`categories.${category.key}`)}</strong>
                  <span className="category-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section soft">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow"><span className="eyebrow-dot" />{t("trust.eyebrow")}</div>
              <h2>{t("trust.title")}</h2>
              <p className="section-copy">{t("trust.description")}</p>
            </div>
            <div className="feature-grid">
              {(["publisher", "versions", "community"] as const).map((key, index) => (
                <article className="feature-card" key={key}>
                  <div className="feature-icon" aria-hidden="true">{["◎", "↻", "✳"][index]}</div>
                  <h3>{t(`trust.${key}`)}</h3>
                  <p>{t(`trust.${key}Text`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="developer-panel">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" />{t("developers.eyebrow")}</div>
                <h2>{t("developers.title")}</h2>
                <p>{t("developers.description")}</p>
              </div>
              <a className="primary-link" href="https://open.globeapps.com">{t("developers.action")} <span aria-hidden="true">→</span></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div><strong style={{ color: "#475467" }}>Globe Play</strong> · {t("footer.tagline")}</div>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/privacy">{t("footer.privacy")}</a>
            <a href="/terms">{t("footer.terms")}</a>
            <a href="/support">{t("footer.support")}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
