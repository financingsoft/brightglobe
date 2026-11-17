import assert from "node:assert/strict";
import test from "node:test";
import {
  getBgDailyIdempotencyKey,
  getBgDailyPeriodKey
} from "./bg-reward-engine.js";

const USER_ID = "019a8e5a-4a00-7000-8000-000000000001";

test("BG daily period is derived from UTC rather than the user's local timezone", () => {
  assert.equal(getBgDailyPeriodKey(new Date("2026-11-17T23:59:59.999Z")), "2026-11-17");
  assert.equal(getBgDailyPeriodKey(new Date("2026-11-18T00:00:00.000Z")), "2026-11-18");
});

test("BG daily idempotency key is stable for one canonical user and UTC date", () => {
  assert.equal(
    getBgDailyIdempotencyKey(USER_ID, "2026-11-17"),
    `bg-daily-collection:${USER_ID}:2026-11-17`
  );
  assert.notEqual(
    getBgDailyIdempotencyKey(USER_ID, "2026-11-17"),
    getBgDailyIdempotencyKey(USER_ID, "2026-11-18")
  );
  assert.throws(() => getBgDailyIdempotencyKey("better-auth-local-id", "2026-11-17"));
  assert.throws(() => getBgDailyIdempotencyKey(USER_ID, "2026-02-30"));
  assert.throws(() => getBgDailyIdempotencyKey(USER_ID, "17-11-2026"));
});

test("BG daily period rejects an invalid server timestamp", () => {
  assert.throws(() => getBgDailyPeriodKey(new Date(Number.NaN)));
});
