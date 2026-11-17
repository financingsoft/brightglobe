import assert from "node:assert/strict";
import test from "node:test";
import { createPublicReadApp } from "./app.js";
import type { PublicReadRepository } from "./repository.js";

const appDetail = {
  id: "018f47b2-5c20-7a00-8000-000000000001",
  slug: "sample-app",
  name: "Sample App",
  tagline: "A useful sample",
  description: "Published application description.",
  appType: "app" as const,
  contentLocale: "en",
  publisher: { slug: "sample-publisher", name: "Sample Publisher", verificationStatus: "verified" as const, websiteUrl: "https://publisher.example" },
  categories: [],
  media: [],
  platforms: [{ platform: "android", minimumOsVersion: "10", availabilityStatus: "available" as const }],
  latestVersions: [],
  privacyPolicyUrl: null,
  supportUrl: null,
  websiteUrl: null,
  rating: { average: 4.5, count: 10 },
  publishedAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-10T00:00:00.000Z"
};

function repository(overrides: Partial<PublicReadRepository> = {}): PublicReadRepository {
  return {
    getApp: async () => ({ payload: appDetail, contentLocale: "en", updatedAt: appDetail.updatedAt }),
    getReviews: async () => ({
      app: { payload: appDetail, contentLocale: "en", updatedAt: appDetail.updatedAt },
      items: []
    }),
    ...overrides
  };
}

const config = {
  defaultLocale: "en",
  supportedLocales: ["en", "zh-CN"],
  cursorSecret: "test-only-cursor-secret-with-more-than-32-characters"
};

test("public app detail returns a cacheable published projection without cookies", async () => {
  const app = createPublicReadApp(repository(), config);
  const response = await app.request("/api/v1/play/apps/sample-app?locale=en");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control") ?? "", /s-maxage=600/);
  assert.ok(response.headers.get("ETag"));
  assert.ok(response.headers.get("X-Request-Id"));
  assert.equal(response.headers.get("Set-Cookie"), null);
  const body = await response.json() as { data: { name: string }; meta: { schemaVersion: number } };
  assert.equal(body.data.name, "Sample App");
  assert.equal(body.meta.schemaVersion, 1);
});

test("unknown and unpublished apps share the same public 404 response", async () => {
  const app = createPublicReadApp(repository({ getApp: async () => null }), config);
  const response = await app.request("/api/v1/play/apps/not-published?locale=en");
  assert.equal(response.status, 404);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "NOT_FOUND");
});

test("unsupported locale is rejected and does not reach repository", async () => {
  let called = false;
  const app = createPublicReadApp(repository({ getApp: async () => { called = true; return null; } }), config);
  const response = await app.request("/api/v1/play/apps/sample-app?locale=fr");
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("strict projection schema rejects accidental private fields", async () => {
  const unsafe = { ...appDetail, ownerEmail: "private@example.test" };
  const app = createPublicReadApp(repository({
    getApp: async () => ({ payload: unsafe, contentLocale: "en", updatedAt: appDetail.updatedAt })
  }), config);
  const response = await app.request("/api/v1/play/apps/sample-app?locale=en");
  assert.equal(response.status, 503);
});

test("reviews are bounded, anonymous and use the shorter cache TTL", async () => {
  let requestedLimit = 0;
  const app = createPublicReadApp(repository({
    getReviews: async (_slug, _locale, _fallback, _cursor, limit) => {
      requestedLimit = limit;
      return {
        app: { payload: appDetail, contentLocale: "en", updatedAt: appDetail.updatedAt },
        items: []
      };
    }
  }), config);
  const response = await app.request("/api/v1/play/apps/sample-app/reviews?locale=en&limit=1000");
  assert.equal(response.status, 200);
  assert.equal(requestedLimit, 21);
  assert.match(response.headers.get("Cache-Control") ?? "", /s-maxage=120/);
  const body = await response.json() as { data: { pageInfo: { hasNextPage: boolean } } };
  assert.equal(body.data.pageInfo.hasNextPage, false);
});

test("invalid review cursor is rejected", async () => {
  const app = createPublicReadApp(repository(), config);
  const response = await app.request("/api/v1/play/apps/sample-app/reviews?locale=en&cursor=forged.cursor");
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "INVALID_CURSOR");
});
