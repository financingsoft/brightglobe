import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";
import { matchesFinalizedTransactionEnvelope } from "../indexer/transaction-verifier.js";
import {
  hasExactFinalizedTransfer,
  type BgDevnetPayoutReconciliationCandidate,
  type BgDevnetPayoutRepository
} from "./bg-devnet-payout-executor.js";

export interface BgDevnetPayoutReconciliationRpc {
  getDevnetStatus(): Promise<{ healthy: boolean; genesisHash: string }>;
  /** Must query signature status with searchTransactionHistory=true. */
  getSignatureStatus(signature: string): Promise<{
    confirmationStatus: "processed" | "confirmed" | "finalized" | null;
    err: unknown | null;
    slot: number | null;
  }>;
  getFinalizedBlockHeight(): Promise<number>;
  /** Must use finalized commitment and return the full jsonParsed transaction. */
  getFinalizedTransaction(signature: string): Promise<unknown | null>;
  /**
   * An authoritative archive lookup for the fee payer's complete finalized
   * transaction history. complete=true is only valid when the adapter can
   * prove the searched history is exhaustive through the finalized chain tip.
   */
  getSignatureHistoryEvidence(input: {
    feePayerAddress: string;
    signature: string;
  }): Promise<{ found: boolean; complete: boolean }>;
}

export interface BgDevnetPayoutReconcilerConfig {
  enabled: boolean;
  workerId: string;
  batchSize?: number;
}

export interface BgDevnetPayoutReconciliationSummary {
  outcome: "disabled" | "empty" | "processed";
  examined: number;
  paid: number;
  failed: number;
  expired: number;
  quarantined: number;
  awaitingFinality: number;
  deferred: number;
}

function transactionMetaError(transaction: unknown): unknown | undefined {
  if (typeof transaction !== "object" || transaction === null || Array.isArray(transaction)) return undefined;
  const meta = (transaction as Record<string, unknown>).meta;
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return undefined;
  return (meta as Record<string, unknown>).err;
}

function transactionSlot(transaction: unknown): bigint | null {
  if (typeof transaction !== "object" || transaction === null || Array.isArray(transaction)) return null;
  const slot = (transaction as Record<string, unknown>).slot;
  return typeof slot === "number" && Number.isSafeInteger(slot) && slot >= 0 ? BigInt(slot) : null;
}

function hasFinalizedFailedEnvelope(
  transaction: unknown,
  candidate: BgDevnetPayoutReconciliationCandidate
): boolean {
  if (!candidate.signature || !candidate.recentBlockhash) return false;
  const slot = transactionSlot(transaction);
  return slot !== null &&
    transactionMetaError(transaction) !== undefined &&
    transactionMetaError(transaction) !== null &&
    matchesFinalizedTransactionEnvelope(transaction, candidate.signature, candidate.recentBlockhash, slot);
}

type MutableStatus = BgDevnetPayoutReconciliationCandidate["status"];

export async function reconcileBgDevnetPayouts(input: {
  config: BgDevnetPayoutReconcilerConfig;
  repository: BgDevnetPayoutRepository;
  rpc: BgDevnetPayoutReconciliationRpc;
}): Promise<BgDevnetPayoutReconciliationSummary> {
  const { config, repository, rpc } = input;
  const summary: BgDevnetPayoutReconciliationSummary = {
    outcome: "processed",
    examined: 0,
    paid: 0,
    failed: 0,
    expired: 0,
    quarantined: 0,
    awaitingFinality: 0,
    deferred: 0
  };
  if (!config.enabled) return { ...summary, outcome: "disabled" };
  if (!config.workerId || config.workerId.length > 128) {
    throw new TypeError("A bounded BG payout reconciliation worker ID is required.");
  }
  const batchSize = config.batchSize ?? 10;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    throw new RangeError("BG payout reconciliation batch size must be between 1 and 50.");
  }

  const candidates = await repository.claimReconciliationBatch(config.workerId, batchSize);
  if (candidates.length === 0) return { ...summary, outcome: "empty" };
  summary.examined = candidates.length;

  if (candidates.some((candidate) => candidate.status !== "finalized")) {
    try {
      const cluster = await rpc.getDevnetStatus();
      if (!cluster.healthy || cluster.genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
        summary.deferred += candidates.length;
        return summary;
      }
    } catch {
      summary.deferred += candidates.length;
      return summary;
    }
  }

  for (const candidate of candidates) {
    let status: MutableStatus = candidate.status;
    const transition = async (
      to: "submitted" | "confirmed" | "finalized" | "reconciliation_required" | "failed" | "expired" | "quarantined",
      evidence: Record<string, unknown>,
      options: { errorCode?: string; slot?: bigint } = {}
    ): Promise<boolean> => repository.transition({
      payoutIntentId: candidate.id,
      from: status,
      to,
      ...(candidate.signature ? { signature: candidate.signature } : {}),
      ...(options.slot !== undefined ? { slot: options.slot } : {}),
      ...(options.errorCode ? { errorCode: options.errorCode } : {}),
      evidence
    }).then((changed) => {
      if (changed) status = to;
      return changed;
    });

    const quarantine = async (reason: string): Promise<void> => {
      if (await transition("quarantined", { integrityMismatch: true, reason }, {
        errorCode: "PAYOUT_RECONCILIATION_INTEGRITY_MISMATCH"
      })) summary.quarantined += 1;
      else summary.deferred += 1;
    };

    const settle = async (signature: string, slot: bigint): Promise<void> => {
      try {
        if (await repository.settleFinalizedPayoutOnce({
          payoutIntentId: candidate.id,
          signature,
          finalizedSlot: slot
        })) summary.paid += 1;
        else summary.deferred += 1;
      } catch {
        // Keep finalized evidence intact; retry this idempotent ledger settlement.
        summary.deferred += 1;
      }
    };

    const markFinalized = async (slot: bigint): Promise<void> => {
      if (status === "signed") {
        if (!await transition("submitted", { chainObservation: "finalized" })) {
          summary.deferred += 1; return;
        }
      }
      if (status !== "finalized") {
        if (!await transition("finalized", { finalizedTransferVerified: true }, { slot })) {
          summary.deferred += 1; return;
        }
      }
      if (!candidate.signature) { await quarantine("finalized_payout_missing_signature"); return; }
      await settle(candidate.signature, slot);
    };

    const markFailed = async (): Promise<void> => {
      if (status === "signed") {
        if (!await transition("submitted", { chainObservation: "finalized" })) {
          summary.deferred += 1; return;
        }
      }
      if (await transition("failed", { definitiveFailureVerified: true }, {
        errorCode: "PAYOUT_FINALIZED_CHAIN_FAILURE"
      })) summary.failed += 1;
      else summary.deferred += 1;
    };

    const exactTransfer = (transaction: unknown): boolean => {
      if (!candidate.signature || !candidate.recentBlockhash) return false;
      return hasExactFinalizedTransfer(transaction, candidate.signature, {
        id: candidate.id,
        network: candidate.network,
        mintAddress: candidate.mintAddress,
        tokenProgram: candidate.tokenProgram,
        sourceTokenAccount: candidate.sourceTokenAccount,
        feePayerAddress: candidate.feePayerAddress,
        treasuryAuthorityAddress: candidate.treasuryAuthorityAddress,
        destinationWallet: candidate.destinationWallet,
        destinationTokenAccount: candidate.destinationTokenAccount,
        amountBaseUnits: candidate.amountBaseUnits,
        signerProvider: "external",
        signerKeyReference: "reconciliation-only",
        decimals: candidate.decimals,
        maxSinglePayoutBaseUnits: candidate.amountBaseUnits,
        remainingRollingOutflowBaseUnits: candidate.amountBaseUnits
      }, candidate.recentBlockhash);
    };

    try {
      if (
        candidate.network !== "devnet" ||
        candidate.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
        !candidate.signature ||
        !candidate.recentBlockhash ||
        candidate.lastValidBlockHeight === null ||
        candidate.decimals < 0 ||
        candidate.decimals > 18 ||
        candidate.amountBaseUnits <= 0n
      ) {
        await quarantine("persisted_payout_identity_or_signature_evidence_incomplete");
        continue;
      }

      // Finalized rows already contain verified chain evidence. Only retry
      // their idempotent internal ledger settlement.
      if (status === "finalized") {
        if (candidate.finalizedSlot === null) {
          await quarantine("finalized_payout_missing_finalized_slot");
          continue;
        }
        await settle(candidate.signature, candidate.finalizedSlot);
        continue;
      }

      const observation = await rpc.getSignatureStatus(candidate.signature);
      if (observation.confirmationStatus === "finalized") {
        const transaction = await rpc.getFinalizedTransaction(candidate.signature);
        if (transaction === null) { summary.deferred += 1; continue; }
        const slot = transactionSlot(transaction);
        if (slot === null || (observation.slot !== null && slot !== BigInt(observation.slot))) {
          await quarantine("finalized_signature_slot_mismatch");
          continue;
        }
        const metaError = transactionMetaError(transaction);
        if (observation.err !== null || metaError !== null) {
          if (metaError === undefined || !hasFinalizedFailedEnvelope(transaction, candidate)) {
            await quarantine("finalized_failed_transaction_envelope_mismatch");
          } else {
            await markFailed();
          }
          continue;
        }
        if (!exactTransfer(transaction)) {
          await quarantine("finalized_transaction_does_not_match_exact_payout_intent");
          continue;
        }
        await markFinalized(slot);
        continue;
      }

      if (observation.err !== null && observation.confirmationStatus !== null) {
        // Execution errors are definitive only once the failed transaction is finalized.
        summary.awaitingFinality += 1;
        continue;
      }

      if (observation.confirmationStatus === "confirmed") {
        if (observation.slot === null) { summary.deferred += 1; continue; }
        if (status === "signed") {
          if (!await transition("submitted", { chainObservation: "confirmed" })) {
            summary.deferred += 1; continue;
          }
        }
        if (status !== "confirmed" && status !== "finalized") {
          if (!await transition("confirmed", { chainObservation: "confirmed" }, {
            slot: BigInt(observation.slot)
          })) { summary.deferred += 1; continue; }
        }
        summary.awaitingFinality += 1;
        continue;
      }

      if (observation.confirmationStatus === "processed") {
        if (status === "signed" || status === "reconciliation_required") {
          if (!await transition("submitted", { chainObservation: "processed" })) {
            summary.deferred += 1; continue;
          }
        }
        summary.awaitingFinality += 1;
        continue;
      }

      // A null status is not proof of absence. Only an exhaustive archive scan
      // after the original blockhash expires can release the reservation.
      if (status !== "reconciliation_required") {
        if (!await transition("reconciliation_required", { chainObservation: "unknown" }, {
          errorCode: "PAYOUT_SIGNATURE_NOT_CURRENTLY_VISIBLE"
        })) { summary.deferred += 1; continue; }
      }
      const finalizedHeight = await rpc.getFinalizedBlockHeight();
      if (!Number.isSafeInteger(finalizedHeight) || finalizedHeight < 0) {
        summary.deferred += 1; continue;
      }
      if (BigInt(finalizedHeight) <= candidate.lastValidBlockHeight) {
        summary.awaitingFinality += 1; continue;
      }

      const history = await rpc.getSignatureHistoryEvidence({
        feePayerAddress: candidate.feePayerAddress,
        signature: candidate.signature
      });
      if (history.found) {
        const transaction = await rpc.getFinalizedTransaction(candidate.signature);
        if (transaction === null) { summary.deferred += 1; continue; }
        const slot = transactionSlot(transaction);
        if (slot === null || !matchesFinalizedTransactionEnvelope(
          transaction, candidate.signature, candidate.recentBlockhash, slot
        )) {
          await quarantine("archive_found_signature_but_transaction_envelope_mismatched");
          continue;
        }
        const metaError = transactionMetaError(transaction);
        if (metaError !== null) {
          if (metaError === undefined || !hasFinalizedFailedEnvelope(transaction, candidate)) {
            await quarantine("archive_failed_transaction_envelope_mismatched");
          } else {
            await markFailed();
          }
          continue;
        }
        if (!exactTransfer(transaction)) {
          await quarantine("archive_finalized_transaction_does_not_match_payout_intent");
          continue;
        }
        await markFinalized(slot);
        continue;
      }

      if (!history.complete) { summary.deferred += 1; continue; }
      if (await transition("expired", { definitiveAbsenceAfterExpiry: true }, {
        errorCode: "PAYOUT_EXPIRED_WITH_AUTHORITATIVE_ABSENCE"
      })) summary.expired += 1;
      else summary.deferred += 1;
    } catch {
      // Timeouts and transient failures are not payment failure evidence.
      // The lease expires and this exact signature is examined again later.
      summary.deferred += 1;
    }
  }

  return summary;
}
