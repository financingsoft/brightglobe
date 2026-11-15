import assert from "node:assert/strict";
import test from "node:test";
import { assertBalancedPostings } from "./invariants.js";

test("accepts balanced integer postings", () => {
  assert.doesNotThrow(() => assertBalancedPostings([
    { accountId: "user", deltaBaseUnits: 250n },
    { accountId: "treasury", deltaBaseUnits: -250n }
  ]));
});

test("rejects unbalanced, zero, duplicate and incomplete postings", () => {
  assert.throws(() => assertBalancedPostings([{ accountId: "a", deltaBaseUnits: 1n }]), /at least two/);
  assert.throws(() => assertBalancedPostings([
    { accountId: "a", deltaBaseUnits: 2n },
    { accountId: "b", deltaBaseUnits: -1n }
  ]), /sum to zero/);
  assert.throws(() => assertBalancedPostings([
    { accountId: "a", deltaBaseUnits: 0n },
    { accountId: "b", deltaBaseUnits: 0n }
  ]), /cannot be zero/);
  assert.throws(() => assertBalancedPostings([
    { accountId: "a", deltaBaseUnits: 1n },
    { accountId: "a", deltaBaseUnits: -1n }
  ]), /only once/);
});
