import assert from "node:assert/strict";
import test from "node:test";
import { hasBlockhashExpired } from "./blockhash.js";

test("a blockhash remains valid through its last valid block height", () => {
  assert.equal(hasBlockhashExpired(100n, 100n), false);
  assert.equal(hasBlockhashExpired(99n, 100n), false);
});

test("a blockhash expires only after the last valid block height", () => {
  assert.equal(hasBlockhashExpired(101n, 100n), true);
});

test("rejects negative block heights", () => {
  assert.throws(() => hasBlockhashExpired(-1n, 100n), RangeError);
});
