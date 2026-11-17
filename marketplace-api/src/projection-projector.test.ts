import assert from "node:assert/strict";
import test from "node:test";
import { processProjectionQueueBatch, processProjectionQueueMessage, type ProjectionEventStore, type ProjectionApplyResult } from "./projection-projector.js";
import type { ProjectionOutboxEvent } from "./projection-events.js";

const event: ProjectionOutboxEvent = {
  eventId: "018f47b2-5c20-7a00-8000-000000000010",
  schemaVersion: 1,
  aggregateVersion: 3,
  occurredAt: "2026-11-10T12:00:00.000Z",
  eventType: "app.projection.upsert.v1",
  aggregate: { type: "app", id: "018f47b2-5c20-7a00-8000-000000000001", slug: "sample-app" },
  locale: "en",
  invalidationTags: ["app:sample-app", "app:sample-app:reviews", "app:sample-app:rating", "developer:sample-publisher", "locale:en"],
  projection: {
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
  }
};

function createHarness(initial: ProjectionApplyResult = { status: "applied", cacheInvalidationPending: true }) {
  const calls: string[] = [];
  let result = initial;
  let failPurge = false;
  const store: ProjectionEventStore = {
    async getOutboxEvent(id) {
      calls.push("load:" + id);
      return event;
    },
    async applyAtomically() {
      calls.push("apply");
      const current = result;
      if (current.status === "applied") result = { status: "duplicate", cacheInvalidationPending: current.cacheInvalidationPending };
      return current;
    },
    async markCacheInvalidationComplete(id) {
      calls.push("mark:" + id);
      result = { status: "duplicate", cacheInvalidationPending: false };
    }
  };
  const invalidator = {
    async purge(tags: string[]) {
      calls.push("purge:" + tags.join("|"));
      if (failPurge) throw new Error("Cloudflare purge temporarily unavailable");
    }
  };
  return {
    store,
    invalidator,
    calls,
    failPurge(value: boolean) { failPurge = value; },
    setResult(value: ProjectionApplyResult) { result = value; }
  };
}

const message = { eventId: event.eventId, schemaVersion: 1 };

test("applies projection then purges tags then marks invalidation complete", async () => {
  const h = createHarness();
  const outcome = await processProjectionQueueMessage(message, h.store, h.invalidator);
  assert.equal(outcome, "applied");
  assert.deepEqual(h.calls, [
    "load:" + event.eventId,
    "apply",
    "purge:" + event.invalidationTags.join("|"),
    "mark:" + event.eventId
  ]);
});

test("retries pending cache invalidation after the projection receipt has been committed", async () => {
  const h = createHarness();
  h.failPurge(true);
  await assert.rejects(() => processProjectionQueueMessage(message, h.store, h.invalidator), /purge temporarily unavailable/);
  h.failPurge(false);
  const outcome = await processProjectionQueueMessage(message, h.store, h.invalidator);
  assert.equal(outcome, "duplicate");
  assert.equal(h.calls.filter((call) => call === "apply").length, 2);
  assert.equal(h.calls.filter((call) => call.startsWith("purge:")).length, 2);
  assert.equal(h.calls.filter((call) => call.startsWith("mark:")).length, 1);
});

test("does not purge cache for an event older than the aggregate watermark", async () => {
  const h = createHarness({ status: "stale", cacheInvalidationPending: false });
  const outcome = await processProjectionQueueMessage(message, h.store, h.invalidator);
  assert.equal(outcome, "stale");
  assert.equal(h.calls.some((call) => call.startsWith("purge:")), false);
});

test("does not repeat a completed cache invalidation for a duplicate", async () => {
  const h = createHarness({ status: "duplicate", cacheInvalidationPending: false });
  const outcome = await processProjectionQueueMessage(message, h.store, h.invalidator);
  assert.equal(outcome, "duplicate");
  assert.equal(h.calls.some((call) => call.startsWith("purge:")), false);
});

test("retries when the durable outbox event is not found", async () => {
  const h = createHarness();
  h.store.getOutboxEvent = async () => null;
  await assert.rejects(() => processProjectionQueueMessage(message, h.store, h.invalidator), /not found/);
});

test("rejects a queue message whose event identity does not match the stored event", async () => {
  const h = createHarness();
  await assert.rejects(() => processProjectionQueueMessage({ ...message, eventId: "018f47b2-5c20-7a00-8000-000000000099" }, h.store, h.invalidator), /identity\/version mismatch/);
});

test("rejects malformed queue messages before reading the outbox", async () => {
  const h = createHarness();
  await assert.rejects(() => processProjectionQueueMessage({ ...message, unexpected: true }, h.store, h.invalidator), /Invalid projection Queue message/);
  assert.equal(h.calls.length, 0);
});
test("coalesces duplicate tags across multiple events", async () => {
  const second: ProjectionOutboxEvent = {
    ...event,
    eventId: "018f47b2-5c20-7a00-8000-000000000020",
    aggregateVersion: 4,
    aggregate: { ...event.aggregate, id: "018f47b2-5c20-7a00-8000-000000000002", slug: "second-app" },
    invalidationTags: [
      "app:second-app", "app:second-app:reviews", "app:second-app:rating", "developer:sample-publisher", "locale:en",
      ...Array.from({ length: 45 }, (_, index) => "extra-" + index + ":second-app")
    ],
    projection: { ...event.projection, id: "018f47b2-5c20-7a00-8000-000000000002", slug: "second-app" }
  };
  const first = { ...event, invalidationTags: [
    ...event.invalidationTags,
    ...Array.from({ length: 45 }, (_, index) => "extra-" + index + ":sample-app")
  ] };
  const byId = new Map([[first.eventId, first], [second.eventId, second]]);
  const calls: string[] = [];
  const marked: string[] = [];
  const store: ProjectionEventStore = {
    async getOutboxEvent(id) { return byId.get(id) ?? null; },
    async applyAtomically() { return { status: "applied", cacheInvalidationPending: true }; },
    async markCacheInvalidationComplete(id) { marked.push(id); }
  };
  const invalidator = { async purge(tags: string[]) { calls.push(tags.join("|")); } };
  const outcomes = await processProjectionQueueBatch([
    { eventId: first.eventId, schemaVersion: 1 },
    { eventId: second.eventId, schemaVersion: 1 }
  ], store, invalidator);
  assert.deepEqual(outcomes, ["applied", "applied"]);
  assert.deepEqual(calls.map((call) => call.split("|").length), [98]);
  assert.deepEqual(marked, [first.eventId, second.eventId]);
});
