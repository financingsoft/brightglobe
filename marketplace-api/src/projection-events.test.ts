import assert from "node:assert/strict";
import test from "node:test";
import { projectionOutboxEventSchema, projectionQueueMessageSchema } from "./projection-events.js";

const app = {
  id: "018f47b2-5c20-7a00-8000-000000000001",
  slug: "sample-app",
  name: "Sample App",
  tagline: null,
  description: "Published description",
  appType: "app",
  contentLocale: "en",
  publisher: { slug: "sample-publisher", name: "Sample Publisher", verificationStatus: "verified", websiteUrl: null },
  categories: [],
  media: [],
  platforms: [],
  latestVersions: [],
  privacyPolicyUrl: null,
  supportUrl: null,
  websiteUrl: null,
  publishedAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:00:00.000Z"
};

test("accepts a sanitized app projection event with matching identity", () => {
  const parsed = projectionOutboxEventSchema.safeParse({
    eventId: "018f47b2-5c20-7a00-8000-000000000010",
    schemaVersion: 1,
    aggregateVersion: 3,
    occurredAt: "2026-11-10T12:00:00.000Z",
    eventType: "app.projection.upsert.v1",
    aggregate: { type: "app", id: app.id, slug: app.slug },
    locale: "en",
    projection: app
  });
  assert.equal(parsed.success, true);
});

test("rejects an app projection whose slug or locale differs from its event envelope", () => {
  const parsed = projectionOutboxEventSchema.safeParse({
    eventId: "018f47b2-5c20-7a00-8000-000000000010",
    schemaVersion: 1,
    aggregateVersion: 3,
    occurredAt: "2026-11-10T12:00:00.000Z",
    eventType: "app.projection.upsert.v1",
    aggregate: { type: "app", id: app.id, slug: "different-app" },
    locale: "zh-CN",
    projection: app
  });
  assert.equal(parsed.success, false);
});

test("rejects private fields in a public projection event", () => {
  const parsed = projectionOutboxEventSchema.safeParse({
    eventId: "018f47b2-5c20-7a00-8000-000000000010",
    schemaVersion: 1,
    aggregateVersion: 3,
    occurredAt: "2026-11-10T12:00:00.000Z",
    eventType: "app.projection.upsert.v1",
    aggregate: { type: "app", id: app.id, slug: app.slug },
    locale: "en",
    projection: { ...app, ownerEmail: "private@example.test" }
  });
  assert.equal(parsed.success, false);
});

test("queue message contains only event reference, not projection payload", () => {
  assert.equal(projectionQueueMessageSchema.safeParse({
    eventId: "018f47b2-5c20-7a00-8000-000000000010",
    schemaVersion: 1
  }).success, true);
  assert.equal(projectionQueueMessageSchema.safeParse({
    eventId: "018f47b2-5c20-7a00-8000-000000000010",
    schemaVersion: 1,
    projection: app
  }).success, false);
});
