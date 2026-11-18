import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBgPayoutTransition,
  canTransitionBgPayout,
  isBgPayoutTerminal
} from "./bg-payout-lifecycle.js";

test("payout cannot become paid before finalized chain verification and ledger settlement", () => {
  assert.equal(canTransitionBgPayout("confirmed", "paid", {
    ledgerSettlementCommitted: true,
    finalizedTransferVerified: true
  }), false);
  assert.equal(canTransitionBgPayout("finalized", "paid"), false);
  assert.equal(canTransitionBgPayout("finalized", "paid", {
    ledgerSettlementCommitted: true
  }), true);
});

test("ambiguous broadcast enters reconciliation and never returns to signing", () => {
  assert.equal(canTransitionBgPayout("submitted", "reconciliation_required", {
    broadcastOutcomeAmbiguous: true
  }), true);
  assert.equal(canTransitionBgPayout("reconciliation_required", "signing", {
    notBroadcastVerified: true
  }), false);
  assert.equal(canTransitionBgPayout("reconciliation_required", "submitted", {
    broadcastAccepted: true
  }), true);
});

test("finality requires exact transfer verification and mismatch requires quarantine", () => {
  assert.equal(canTransitionBgPayout("submitted", "finalized"), false);
  assert.equal(canTransitionBgPayout("submitted", "finalized", {
    finalizedTransferVerified: true
  }), true);
  assert.equal(canTransitionBgPayout("confirmed", "quarantined"), false);
  assert.equal(canTransitionBgPayout("confirmed", "quarantined", {
    integrityMismatch: true
  }), true);
});

test("failed, cancelled and expired transitions require proof that funds cannot still land", () => {
  assert.equal(canTransitionBgPayout("signed", "failed", {}), false);
  assert.equal(canTransitionBgPayout("signing", "failed", {
    notBroadcastVerified: true
  }), true);
  assert.equal(canTransitionBgPayout("submitted", "failed", {
    definitiveFailureVerified: true
  }), true);
  assert.equal(canTransitionBgPayout("submitted", "cancelled", {
    notBroadcastVerified: true
  }), false);
  assert.equal(canTransitionBgPayout("reconciliation_required", "expired", {
    definitiveAbsenceAfterExpiry: true
  }), true);
});

test("terminal states cannot be reopened", () => {
  for (const status of ["paid", "failed", "expired", "quarantined", "cancelled"] as const) {
    assert.equal(isBgPayoutTerminal(status), true);
    assert.equal(canTransitionBgPayout(status, "queued"), false);
  }
  assert.throws(() => assertBgPayoutTransition("submitted", "paid", {
    finalizedTransferVerified: true,
    ledgerSettlementCommitted: true
  }), /Invalid BG payout transition/);
});
