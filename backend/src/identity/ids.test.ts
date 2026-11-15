import assert from "node:assert/strict";
import test from "node:test";
import { createUuidV7, isUuidV7 } from "./ids.js";

test("creates RFC 9562 UUIDv7 values with correct version and variant bits", () => {
  const id = createUuidV7(1_800_000_000_000);
  assert.equal(isUuidV7(id), true);
  assert.equal(id[14], "7");
  assert.match(id[19]!, /^[89ab]$/);
});

test("preserves timestamp ordering across different milliseconds", () => {
  const earlier = createUuidV7(1_800_000_000_000);
  const later = createUuidV7(1_800_000_000_001);
  assert.ok(earlier < later);
});

test("rejects timestamps outside the UUIDv7 48-bit range", () => {
  assert.throws(() => createUuidV7(-1), RangeError);
  assert.throws(() => createUuidV7(0x1_0000_0000_0000), RangeError);
});

test("creates distinct IDs for a burst of allocations", () => {
  const ids = new Set(Array.from({ length: 2_000 }, () => createUuidV7()));
  assert.equal(ids.size, 2_000);
});
