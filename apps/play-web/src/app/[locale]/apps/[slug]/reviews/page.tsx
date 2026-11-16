import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublicReviews, type PublicLocale } from "@/lib/public-api";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== "en" && locale !== "zh-CN") return {};
  const reviews = await getPublicReviews(slug, locale as PublicLocale);
  if (!reviews) return { robots: { index: false, follow: false } };
  return {
    title: `${reviews.app.name} — ${locale === "en" ? "Reviews" : "用户评价"}`,
    description: locale === "en" ? `First-hand experiences with ${reviews.app.name}.` : `查看用户对 ${reviews.app.name} 的真实体验反馈。`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/apps/${reviews.app.slug}/reviews` }
  };
}

export default async function AppReviewsPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (locale !== "en" && locale !== "zh-CN") notFound();
  setRequestLocale(locale);
  const [reviews, t] = await Promise.all([
    getPublicReviews(slug, locale as PublicLocale),
    getTranslations("appReviews")
  ]);
  if (!reviews) notFound();

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="container" style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <Link className="brand" href="/"><span className="brand-mark">G</span><span>Globe Play</span></Link>
          <div className="nav-right"><Link className="locale-link" href={`/apps/${slug}/reviews`} locale={locale === "en" ? "zh-CN" : "en"}>{locale === "en" ? "中文" : "English"}</Link></div>
        </div>
      </header>
      <div className="container app-detail">
        <nav className="breadcrumbs" aria-label={t("breadcrumbs")}><Link href={`/apps/${slug}`}>{reviews.app.name}</Link><span aria-hidden="true">/</span><span aria-current="page">{t("title")}</span></nav>
        <section className="page-heading review-heading"><div className="eyebrow"><span className="eyebrow-dot" />{t("eyebrow")}</div><h1>{reviews.app.name} — {t("title")}</h1><p className="section-copy">{t("description")}</p>
          {reviews.rating ? <p className="review-rating">★ {reviews.rating.average.toFixed(1)} <span>{t("basedOn", { count: reviews.rating.count.toLocaleString(locale) })}</span></p> : null}
        </section>
        <section className="review-list" aria-label={t("title")}>
          {reviews.items.length ? reviews.items.map((review) => <article className="review-card" key={review.id}>
            <div className="review-card-head"><strong>{review.author.displayName}</strong><time dateTime={review.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(review.createdAt))}</time></div>
            {review.rating !== null ? <div className="review-stars" aria-label={t("ratingOutOfFive", { rating: review.rating })}>{"★".repeat(Math.max(0, Math.min(5, review.rating)))}</div> : null}
            {review.title ? <h2>{review.title}</h2> : null}<p>{review.body}</p>
            <div className="review-card-foot">{review.appVersion ? <span>{t("version", { version: review.appVersion })}</span> : null}<span>{t("helpfulCount", { count: review.helpfulCount })}</span>{review.author.publisherAffiliation !== "none" ? <span>{t("affiliationDisclosed")}</span> : null}</div>
          </article>) : <div className="empty-state">{t("empty")}</div>}
        </section>
      </div>
    </main>
  );
}
