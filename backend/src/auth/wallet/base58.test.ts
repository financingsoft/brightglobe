import assert from "node:assert/strict";
import test from "node:test";
import { decodeBase58 } from "./base58.js";

test("decodes leading zero bytes", () => {
  assert.deepEqual([...decodeBase58("111")!], [0, 0, 0]);
});

test("rejects invalid alphabet and unexpected byte length", () => {
  assert.equal(decodeBase58("0OIl"), null);
  assert.equal(decodeBase58("111", 64), null);
});
