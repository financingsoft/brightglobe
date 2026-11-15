import assert from "node:assert/strict";
import test from "node:test";
import { assertAssetTransactionTransition, canTransitionAssetTransaction } from "./state-machine.js";

test("allows progression from created to finalized", () => {
  assert.equal(canTransitionAssetTransaction("created", "signed"), true);
  assert.equal(canTransitionAssetTransaction("signed", "submitted"), true);
  assert.equal(canTransitionAssetTransaction("submitted", "confirmed"), true);
  assert.equal(canTransitionAssetTransaction("confirmed", "finalized"), true);
});

test("does not treat submitted as finalized or allow terminal-state rewrites", () => {
  assert.equal(canTransitionAssetTransaction("submitted", "finalized"), false);
  assert.equal(canTransitionAssetTransaction("finalized", "confirmed"), false);
  assert.equal(canTransitionAssetTransaction("failed", "submitted"), false);
  assert.throws(() => assertAssetTransactionTransition("submitted", "finalized"), /Invalid/);
});
