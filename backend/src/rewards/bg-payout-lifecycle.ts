export type BgPayoutStatus =
  | "queued"
  | "signing"
  | "signed"
  | "submitted"
  | "confirmed"
  | "finalized"
  | "paid"
  | "reconciliation_required"
  | "failed"
  | "expired"
  | "quarantined"
  | "cancelled";

export interface BgPayoutTransitionEvidence {
  /** The broadcast request may have reached the RPC even if the caller timed out. */
  broadcastOutcomeAmbiguous?: boolean;
  /** The RPC accepted the exact persisted transaction signature. */
  broadcastAccepted?: boolean;
  /** A chain observation for the already-persisted signature. */
  chainObservation?: "processed" | "confirmed" | "finalized" | "failed" | "absent" | "unknown";
  /** The same signature was checked against history after its blockhash expired. */
  definitiveAbsenceAfterExpiry?: boolean;
  /** Exact mint, token program, source, destination and integer amount were verified. */
  finalizedTransferVerified?: boolean;
  /** Chain evidence proves the submitted transaction failed and cannot settle. */
  definitiveFailureVerified?: boolean;
  /** Proves no signed transaction was submitted or could have reached an RPC. */
  notBroadcastVerified?: boolean;
  /** The internal reward ledger settlement committed exactly once. */
  ledgerSettlementCommitted?: boolean;
  /** A chain/account/instruction/signature invariant did not match the payout intent. */
  integrityMismatch?: boolean;
}

const TERMINAL_STATUSES = new Set<BgPayoutStatus>([
  "paid", "failed", "expired", "quarantined", "cancelled"
]);

const ALLOWED: Record<BgPayoutStatus, readonly BgPayoutStatus[]> = {
  queued: ["signing", "cancelled", "expired", "quarantined"],
  signing: ["signed", "reconciliation_required", "failed", "cancelled", "expired", "quarantined"],
  signed: ["submitted", "reconciliation_required", "quarantined"],
  submitted: ["confirmed", "finalized", "failed", "reconciliation_required", "quarantined"],
  confirmed: ["finalized", "failed", "reconciliation_required", "quarantined"],
  finalized: ["paid", "quarantined"],
  paid: [],
  reconciliation_required: ["submitted", "confirmed", "finalized", "failed", "expired", "quarantined"],
  failed: [],
  expired: [],
  quarantined: [],
  cancelled: []
};

export function canTransitionBgPayout(
  from: BgPayoutStatus,
  to: BgPayoutStatus,
  evidence: BgPayoutTransitionEvidence = {}
): boolean {
  if (!ALLOWED[from].includes(to)) return false;
  if (TERMINAL_STATUSES.has(from)) return false;

  if (to === "quarantined") return evidence.integrityMismatch === true;
  if (to === "reconciliation_required") {
    return evidence.broadcastOutcomeAmbiguous === true ||
      evidence.chainObservation === "unknown";
  }
  if (to === "signed") return from === "signing" && evidence.notBroadcastVerified === true;
  if (to === "submitted") {
    return evidence.broadcastAccepted === true ||
      evidence.chainObservation === "processed" ||
      evidence.chainObservation === "confirmed" ||
      evidence.chainObservation === "finalized";
  }
  if (to === "confirmed") {
    return evidence.chainObservation === "confirmed" ||
      evidence.chainObservation === "finalized";
  }
  if (to === "finalized") return evidence.finalizedTransferVerified === true;
  if (to === "paid") {
    return from === "finalized" && evidence.ledgerSettlementCommitted === true;
  }
  if (to === "failed") {
    return evidence.notBroadcastVerified === true ||
      evidence.definitiveFailureVerified === true;
  }
  if (to === "expired") {
    if (from === "reconciliation_required") return evidence.definitiveAbsenceAfterExpiry === true;
    return (from === "queued" || from === "signing") && evidence.notBroadcastVerified === true;
  }
  if (to === "cancelled") {
    return (from === "queued" || from === "signing") && evidence.notBroadcastVerified === true;
  }
  return to === "signing";
}

export function assertBgPayoutTransition(
  from: BgPayoutStatus,
  to: BgPayoutStatus,
  evidence: BgPayoutTransitionEvidence = {}
): void {
  if (!canTransitionBgPayout(from, to, evidence)) {
    throw new Error(`Invalid BG payout transition or missing evidence: ${from} -> ${to}.`);
  }
}

export function isBgPayoutTerminal(status: BgPayoutStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
