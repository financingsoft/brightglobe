import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBdBaseUnits,
  getDailyCollectionEventKey,
  getUtcPeriodKey
} from "./bd.js";

test("daily collection period key is derived from UTC date", () => {
  assert.equal(getUtcPeriodKey(new Date("2026-11-13T23:59:59.000Z")), "2026-11-13");
  assert.equal(getUtcPeriodKey(new Date("2026-11-14T00:00:00.000Z")), "2026-11-14");
});

test("daily collection event key is stable and user-specific", () => {
  assert.equal(
    getDailyCollectionEventKey("user-123", "2026-11-13"),
    "daily-collection:user-123:2026-11-13"
  );
  assert.throws(() => getDailyCollectionEventKey("", "2026-11-13"));
  assert.throws(() => getDailyCollectionEventKey("user-123", "13-11-2026"));
});

test("BD base-unit formatting is exact and trims trailing zeros", () => {
  assert.equal(formatBdBaseUnits(0n), "0");
  assert.equal(formatBdBaseUnits(1_000_000n), "1");
  assert.equal(formatBdBaseUnits(1_250_000n), "1.25");
  assert.equal(formatBdBaseUnits(1n), "0.000001");
  assert.equal(formatBdBaseUnits(-1_250_000n), "-1.25");
});
