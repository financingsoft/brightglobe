import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublicApp, type PublicLocale } from "@/lib/public-api";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://play.globeapps.com";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== "en" && locale !== "zh-CN") return {};
  const app = await getPublicApp(slug, locale as PublicLocale);
  if (!app) return { robots: { index: false, follow: false } };
  const canonical = `/${locale}/apps/${app.slug}`;
  return {
    title: app.name,
    description: app.tagline || app.description.slice(0, 155),
    alternates: {
      canonical,
      languages: { en: `/en/apps/${app.slug}`, "zh-CN": `/zh-CN/apps/${app.slug}`, "x-default": `/en/apps/${app.slug}` }
    },
    openGraph: { type: "website", title: app.name, description: app.tagline || app.description.slice(0, 155), url: canonical, siteName: "Globe Play" },
    robots: { index: true, follow: true }
  };
}

export default async function AppDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (locale !== "en" && locale !== "zh-CN") notFound();
  setRequestLocale(locale);
  const [app, t] = await Promise.all([
    getPublicApp(slug, locale as PublicLocale),
    getTranslations("appDetail")
  ]);
  if (!app) notFound();

  const icon = app.media.find((item) => item.type === "icon");
  const rating = app.rating && app.rating.count > 0 ? app.rating : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": app.appType === "game" ? "VideoGame" : "SoftwareApplication",
    name: app.name,
    description: app.tagline || app.description,
    applicationCategory: app.categories[0]?.name,
    operatingSystem: app.platforms.map((platform) => platform.platform).join(", "),
    image: icon?.url,
    url: new URL(`/${locale}/apps/${app.slug}`, siteUrl).toString(),
    publisher: { "@type": "Organization", name: app.publisher.name, url: app.publisher.websiteUrl || undefined },
    ...(rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, ratingCount: rating.count } } : {})
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="container" style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <Link className="brand" href="/"><span className="brand-mark">G</span><span>Globe Play</span></Link>
          <nav className="nav"><Link href="/">{t("explore")}</Link><Link href="/categories">{t("categories")}</Link></nav>
          <div className="nav-right"><Link className="locale-link" href={`/apps/${app.slug}`} locale={locale === "en" ? "zh-CN" : "en"}>{locale === "en" ? "中文" : "English"}</Link></div>
        </div>
      </header>
      <div className="container app-detail">
        <nav className="breadcrumbs" aria-label={t("breadcrumbs")}>
          <Link href="/">{t("explore")}</Link><span aria-hidden="true">/</span>
          <Link href="/categories">{t("categories")}</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{app.name}</span>
        </nav>
        <section className="app-summary">
          {icon ? <img className="app-icon" src={icon.url} alt={icon.alt || app.name} width={112} height={112} /> : <div className="app-icon app-icon-fallback" aria-hidden="true">{app.name.slice(0,1)}</div>}
          <div className="app-summary-copy">
            <div className="eyebrow"><span className="eyebrow-dot" />{app.appType === "game" ? t("game") : t("app")}</div>
            <h1>{app.name}</h1>
            {app.tagline ? <p className="app-tagline">{app.tagline}</p> : null}
            <div className="publisher-line">
              <Link href={`/developers/${app.publisher.slug}`}>{app.publisher.name}</Link>
              {app.publisher.verificationStatus === "verified" ? <span className="verified-label">{t("verifiedPublisher")}</span> : <span className="unverified-label">{t("unverifiedPublisher")}</span>}
            </div>
            <div className="app-meta">
              {rating ? <span>★ {rating.average.toFixed(1)} · {rating.count.toLocaleString(locale)}</span> : <span>{t("noRatings")}</span>}
              <span>{app.platforms.map((p) => p.platform).join(" · ")}</span>
            </div>
          </div>
          <div className="app-actions">
            {app.latestVersions.flatMap((version) => version.distribution).filter((link) => link.type === "official_store_link" || link.type === "developer_download").slice(0,1).map((link) => <a className="primary-link" key={link.url} href={link.url} rel="nofollow noopener noreferrer" target="_blank">{link.label}</a>)}
          </div>
        </section>
        {app.media.filter((item) => item.type === "screenshot" || item.type === "banner").length > 0 ? (
          <section className="app-media" aria-label={t("screenshots")}>
            {app.media.filter((item) => item.type === "screenshot" || item.type === "banner").map((item) => <img key={item.url} src={item.url} alt={item.alt} width={item.width || 720} height={item.height || 1280} loading="lazy" />)}
          </section>
        ) : null}
        <div className="app-content-grid">
          <section className="app-main-column">
            <article className="detail-panel">
              <h2>{t("about")}</h2>
              <p className="app-description">{app.description}</p>
              {app.categories.length > 0 ? <div className="tag-list">{app.categories.map((category) => <span key={category.slug}>{category.name}</span>)}</div> : null}
            </article>
            <article className="detail-panel">
              <div className="panel-heading"><h2>{t("versions")}</h2></div>
              {app.latestVersions.length ? <ol className="version-list">{app.latestVersions.map((version) => <li key={version.platform + version.versionName}><div><strong>{version.versionName}</strong><span>{version.platform}</span></div><time dateTime={version.releasedAt || undefined}>{version.releasedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(version.releasedAt)) : t("dateUnavailable")}</time>{version.releaseNotes ? <p>{version.releaseNotes}</p> : null}</li>)}</ol> : <p className="muted-copy">{t("noVersions")}</p>}
            </article>
            <article className="detail-panel">
              <div className="panel-heading"><h2>{t("reviews")}</h2><Link href={`/apps/${app.slug}/reviews`}>{t("viewAll")}</Link></div>
              <p className="muted-copy">{t("reviewsIntro")}</p>
            </article>
          </section>
          <aside className="app-side-column">
            <section className="detail-panel">
              <h2>{t("publisher")}</h2>
              <strong>{app.publisher.name}</strong>
              <p className="muted-copy">{app.publisher.verificationStatus === "verified" ? t("verifiedPublisher") : t("unverifiedPublisher")}</p>
              {app.publisher.websiteUrl ? <a className="text-link" href={app.publisher.websiteUrl} rel="nofollow noopener noreferrer">{t("publisherWebsite")}</a> : null}
            </section>
            <section className="detail-panel">
              <h2>{t("compatibility")}</h2>
              <ul className="platform-list">{app.platforms.map((platform) => <li key={platform.platform}><strong>{platform.platform}</strong><span>{platform.minimumOsVersion ? t("minimumOs", { version: platform.minimumOsVersion }) : t("versionNotSpecified")}</span></li>)}</ul>
            </section>
            <section className="detail-panel">
              <h2>{t("privacySupport")}</h2>
              {app.privacyPolicyUrl ? <p><a className="text-link" href={app.privacyPolicyUrl} rel="nofollow noopener noreferrer">{t("privacyPolicy")}</a></p> : null}
              {app.supportUrl ? <p><a className="text-link" href={app.supportUrl} rel="nofollow noopener noreferrer">{t("support")}</a></p> : null}
              {app.websiteUrl ? <p><a className="text-link" href={app.websiteUrl} rel="nofollow noopener noreferrer">{t("website")}</a></p> : null}
            </section>
          </aside>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
