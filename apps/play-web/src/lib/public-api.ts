export type PublicLocale = "en" | "zh-CN";

export type PublicAppDetail = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  appType: "app" | "game";
  contentLocale: string;
  publisher: {
    slug: string;
    name: string;
    verificationStatus: "verified" | "unverified";
    websiteUrl: string | null;
  };
  categories: Array<{ slug: string; name: string }>;
  media: Array<{
    type: "icon" | "screenshot" | "video" | "banner";
    url: string;
    alt: string;
    width: number | null;
    height: number | null;
  }>;
  platforms: Array<{
    platform: string;
    minimumOsVersion: string | null;
    availabilityStatus: "available" | "unavailable" | "limited";
  }>;
  latestVersions: Array<{
    platform: string;
    versionName: string;
    releasedAt: string | null;
    releaseNotes: string | null;
    distribution: Array<{
      type: "official_store_link" | "developer_download";
      label: string;
      url: string;
    }>;
  }>;
  privacyPolicyUrl: string | null;
  supportUrl: string | null;
  websiteUrl: string | null;
  rating?: { average: number; count: number };
  publishedAt: string;
  updatedAt: string;
};

export type PublicReviewPage = {
  app: { slug: string; name: string };
  rating?: { average: number; count: number };
  items: Array<{
    id: string;
    title: string | null;
    body: string;
    rating: number | null;
    author: { displayName: string; publisherAffiliation: "none" | "developer" | "employee" | "other" };
    appVersion: string | null;
    createdAt: string;
    helpfulCount: number;
  }>;
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
};

type ApiEnvelope<T> = {
  data: T;
  meta: { schemaVersion: 1; contentLocale: string; requestedLocale: string };
};

const origin = process.env.PLAY_API_ORIGIN?.replace(/\/$/, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readEnvelope<T>(path: string): Promise<T | null> {
  if (!origin) return null;
  try {
    const response = await fetch(new URL(path, origin), {
      headers: { accept: "application/json" },
      next: { revalidate: 600 }
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.meta) || body.meta.schemaVersion !== 1) return null;
    return body.data as T;
  } catch {
    return null;
  }
}

export function getPublicApp(slug: string, locale: PublicLocale) {
  const path = `/api/v1/play/apps/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`;
  return readEnvelope<PublicAppDetail>(path);
}

export function getPublicReviews(slug: string, locale: PublicLocale) {
  const path = `/api/v1/play/apps/${encodeURIComponent(slug)}/reviews?locale=${encodeURIComponent(locale)}&limit=20`;
  return readEnvelope<PublicReviewPage>(path);
}
