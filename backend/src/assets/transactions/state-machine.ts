export type AssetTransactionStatus =
  | "created"
  | "signed"
  | "submitted"
  | "confirmed"
  | "finalized"
  | "failed"
  | "expired";

const ALLOWED_TRANSITIONS: Record<AssetTransactionStatus, readonly AssetTransactionStatus[]> = {
  created: ["signed", "failed", "expired"],
  signed: ["submitted", "failed", "expired"],
  submitted: ["confirmed", "failed", "expired"],
  confirmed: ["finalized", "failed"],
  finalized: [],
  failed: [],
  expired: []
};

export function canTransitionAssetTransaction(
  from: AssetTransactionStatus,
  to: AssetTransactionStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertAssetTransactionTransition(
  from: AssetTransactionStatus,
  to: AssetTransactionStatus
): void {
  if (!canTransitionAssetTransaction(from, to)) {
    throw new Error(`Invalid asset transaction transition: ${from} -> ${to}.`);
  }
}
