export interface FinalizedChainEvidence {
  status: string;
  chainSignature: string | null;
  chainSlot: bigint | null;
  chainCommitment: string | null;
}

export function assertFinalizedChainEvidence(evidence: FinalizedChainEvidence): void {
  if (
    evidence.status !== "finalized" ||
    !evidence.chainSignature ||
    evidence.chainSlot === null ||
    evidence.chainSlot < 0n ||
    evidence.chainCommitment !== "finalized"
  ) {
    throw new Error("Asset ledger settlement requires verified finalized chain evidence.");
  }
}
