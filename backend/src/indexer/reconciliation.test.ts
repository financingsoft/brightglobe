import assert from "node:assert/strict";
import test from "node:test";
import { compareTransactionObservation } from "./indexer-service.js";

test("detects a finalized transaction signature and slot mismatch", () => {
  const discrepancies = compareTransactionObservation(
    { status: "finalized", signature: "expected-signature", slot: 100n },
    { signature: "other-signature", slot: 101n, commitment: "confirmed", error: null }
  );
  assert.deepEqual(discrepancies.map((item) => item.type), [
    "chain_signature_mismatch",
    "chain_slot_mismatch",
    "chain_finality_mismatch"
  ]);
});

test("detects a chain failure that conflicts with a successful internal state", () => {
  const discrepancies = compareTransactionObservation(
    { status: "finalized", signature: "sig", slot: 9n },
    { signature: "sig", slot: 9n, commitment: "finalized", error: { InstructionError: [0, "Custom"] } }
  );
  assert.deepEqual(discrepancies.map((item) => item.type), ["finalized_chain_failure"]);
});

test("does not report a discrepancy for matching finalized evidence", () => {
  assert.deepEqual(compareTransactionObservation(
    { status: "finalized", signature: "sig", slot: 9n },
    { signature: "sig", slot: 9n, commitment: "finalized", error: null }
  ), []);
});
