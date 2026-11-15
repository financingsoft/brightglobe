import assert from "node:assert/strict";
import test from "node:test";
import { assertFinalizedChainEvidence } from "./evidence.js";

test("accepts only finalized chain evidence", () => {
  assert.doesNotThrow(() => assertFinalizedChainEvidence({
    status: "finalized",
    chainSignature: "base58-signature",
    chainSlot: 100n,
    chainCommitment: "finalized"
  }));
});

test("rejects submitted, confirmed, or incomplete chain evidence", () => {
  for (const evidence of [
    { status: "submitted", chainSignature: "sig", chainSlot: 1n, chainCommitment: "processed" },
    { status: "confirmed", chainSignature: "sig", chainSlot: 1n, chainCommitment: "confirmed" },
    { status: "finalized", chainSignature: null, chainSlot: 1n, chainCommitment: "finalized" },
    { status: "finalized", chainSignature: "sig", chainSlot: null, chainCommitment: "finalized" },
    { status: "finalized", chainSignature: "sig", chainSlot: 1n, chainCommitment: "confirmed" }
  ]) {
    assert.throws(() => assertFinalizedChainEvidence(evidence), /finalized chain evidence/);
  }
});
