import assert from "node:assert/strict";
import test from "node:test";
import { decodeReviewCursor, encodeReviewCursor } from "./cursor.js";

const secret = "unit-test-cursor-secret-that-is-longer-than-thirty-two-characters";
const cursor = {
  version: 1 as const,
  appSlug: "sample-app",
  locale: "en",
  createdAt: "2026-11-10T12:00:00.000Z",
  id: "018f47b2-5c20-7a00-8000-000000000001"
};

test("review cursor round-trips and is scoped data", async () => {
  const encoded = await encodeReviewCursor(cursor, secret);
  assert.deepEqual(await decodeReviewCursor(encoded, secret), cursor);
});

test("review cursor rejects tampering", async () => {
  const encoded = await encodeReviewCursor(cursor, secret);
  const forged = encoded.slice(0, -1) + (encoded.endsWith("a") ? "b" : "a");
  await assert.rejects(() => decodeReviewCursor(forged, secret));
});

test("review cursor rejects a different signing secret", async () => {
  const encoded = await encodeReviewCursor(cursor, secret);
  await assert.rejects(() => decodeReviewCursor(encoded, secret + "-other"));
});
