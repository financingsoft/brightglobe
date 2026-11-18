import {
  CLASSIC_SPL_TOKEN_PROGRAM_ID,
  parseClassicSplMint,
  parseClassicSplTokenAccount
} from "../blockchain/solana/token/classic-token.js";
import { buildClassicSplTransferTransaction } from "../blockchain/solana/transfer-builder.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";
import { decodeFinalizedClassicTokenEvents } from "../blockchain/solana/transaction-decoder.js";
import {
  validateBgPayoutSigningRequest,
  type BgPayoutSigner
} from "./bg-payout-signer.js";

export interface BgDevnetPayoutIntent {
  id: string;
  network: string;
  mintAddress: string;
  tokenProgram: string;
  sourceTokenAccount: string;
  feePayerAddress: string;
  treasuryAuthorityAddress: string;
  destinationWallet: string;
  destinationTokenAccount: string;
  amountBaseUnits: bigint;
  signerProvider: "kms" | "hsm" | "external";
  signerKeyReference: string;
  decimals: number;
  maxSinglePayoutBaseUnits: bigint;
  remainingRollingOutflowBaseUnits: bigint;
}

export interface BgDevnetPayoutRepository {
  /** Must atomically claim exactly one queued intent (UPDATE ... WHERE status='queued' RETURNING). */
  claimNextQueued(workerId: string): Promise<BgDevnetPayoutIntent | null>;
  /** Must atomically persist signature and blockhash while status is still signing. */
  persistSigned(input: {
    payoutIntentId: string;
    signature: string;
    recentBlockhash: string;
    lastValidBlockHeight: bigint;
  }): Promise<boolean>;
  transition(input: {
    payoutIntentId: string;
    from: "signing" | "signed" | "submitted" | "confirmed" | "reconciliation_required";
    to: "submitted" | "confirmed" | "finalized" | "reconciliation_required" | "failed" | "quarantined";
    signature?: string;
    slot?: bigint;
    errorCode?: string;
    evidence: Record<string, unknown>;
  }): Promise<boolean>;
  /** Must settle reward ledger and mark payout paid in one DB transaction, idempotently. */
  settleFinalizedPayoutOnce(input: {
    payoutIntentId: string;
    signature: string;
    finalizedSlot: bigint;
  }): Promise<boolean>;
}

export interface BgPayoutAccountSnapshot {
  owner: string;
  dataBase64: string;
  executable: boolean;
  lamports: number;
}

export interface BgDevnetPayoutRpc {
  getDevnetStatus(): Promise<{ healthy: boolean; genesisHash: string }>;
  getAccount(address: string): Promise<BgPayoutAccountSnapshot | null>;
  getLamports(address: string): Promise<number>;
  getMinimumBalanceForRentExemption(dataLength: number): Promise<number>;
  getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }>;
  getFeeForTransaction(unsignedTransactionBase64: string): Promise<number>;
  simulateTransaction(unsignedTransactionBase64: string): Promise<{ err: unknown | null }>;
  /** Production wiring is intentionally absent in this phase; tests inject a fake implementation. */
  sendRawTransaction(signedTransactionBase64: string): Promise<string>;
  getSignatureStatus(signature: string): Promise<{
    confirmationStatus: "processed" | "confirmed" | "finalized" | null;
    err: unknown | null;
    slot: number | null;
  }>;
  getFinalizedTransaction(signature: string): Promise<unknown | null>;
}

export interface BgDevnetPayoutExecutorConfig {
  enabled: boolean;
  workerId: string;
}

export type BgDevnetPayoutExecutionResult =
  | { outcome: "disabled" }
  | { outcome: "empty" }
  | { outcome: "submitted"; payoutIntentId: string; signature: string }
  | { outcome: "confirmed"; payoutIntentId: string; signature: string; slot: bigint }
  | { outcome: "paid"; payoutIntentId: string; signature: string; slot: bigint }
  | { outcome: "reconciliation_required"; payoutIntentId: string; signature: string | null }
  | { outcome: "quarantined"; payoutIntentId: string; reason: string };

function isSafeLamports(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasExactFinalizedTransfer(
  transaction: unknown,
  signature: string,
  intent: BgDevnetPayoutIntent
): bigint | null {
  if (typeof transaction !== "object" || transaction === null || Array.isArray(transaction)) return null;
  const root = transaction as Record<string, unknown>;
  if (!Number.isSafeInteger(root.slot) || typeof root.slot !== "number" || root.slot < 0) return null;
  const tx = root.transaction;
  if (typeof tx !== "object" || tx === null || Array.isArray(tx)) return null;
  const txRecord = tx as Record<string, unknown>;
  const signatures = txRecord.signatures;
  if (!Array.isArray(signatures) || signatures[0] !== signature) return null;
  const meta = root.meta;
  if (typeof meta !== "object" || meta === null || Array.isArray(meta) ||
      (meta as Record<string, unknown>).err !== null) return null;

  const events = decodeFinalizedClassicTokenEvents(signature, transaction);
  const exact = events.some((event) => {
    const p = event.payload;
    return event.eventType === "transfer" &&
      p.originalType === "transferChecked" &&
      p.source === intent.sourceTokenAccount &&
      p.destination === intent.destinationTokenAccount &&
      p.authority === intent.treasuryAuthorityAddress &&
      p.mint === intent.mintAddress &&
      p.amountBaseUnits === intent.amountBaseUnits.toString() &&
      p.decimals === intent.decimals;
  });
  return exact ? BigInt(root.slot) : null;
}

/**
 * Executes one queued payout behind explicit Devnet-only ports.
 *
 * This module deliberately supplies no live signer, RPC broadcast adapter or
 * Worker route. The executor is inert unless enabled by its caller; tests use
 * deterministic fake ports. An ambiguous send is never re-signed or replayed.
 */
export async function executeNextBgDevnetPayout(input: {
  config: BgDevnetPayoutExecutorConfig;
  repository: BgDevnetPayoutRepository;
  rpc: BgDevnetPayoutRpc;
  signer: BgPayoutSigner;
}): Promise<BgDevnetPayoutExecutionResult> {
  const { config, repository, rpc, signer } = input;
  if (!config.enabled) return { outcome: "disabled" };
  if (!config.workerId || config.workerId.length > 128) {
    throw new TypeError("A bounded BG payout worker ID is required.");
  }

  const intent = await repository.claimNextQueued(config.workerId);
  if (!intent) return { outcome: "empty" };

  const quarantine = async (reason: string): Promise<BgDevnetPayoutExecutionResult> => {
    await repository.transition({
      payoutIntentId: intent.id,
      from: "signing",
      to: "quarantined",
      errorCode: "PAYOUT_INTEGRITY_MISMATCH",
      evidence: { reason }
    });
    return { outcome: "quarantined", payoutIntentId: intent.id, reason };
  };
  const failBeforeBroadcast = async (errorCode: string): Promise<void> => {
    await repository.transition({
      payoutIntentId: intent.id,
      from: "signing",
      to: "failed",
      errorCode,
      evidence: { notBroadcastVerified: true }
    });
  };

  let persistedSignature: string | null = null;
  try {
    if (intent.network !== "devnet" || intent.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID) {
      return await quarantine("network_or_token_program_mismatch");
    }
    const cluster = await rpc.getDevnetStatus();
    if (!cluster.healthy || cluster.genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
      await failBeforeBroadcast("DEVNET_CLUSTER_UNAVAILABLE");
      return { outcome: "quarantined", payoutIntentId: intent.id, reason: "devnet_cluster_unavailable_or_mismatched" };
    }

    const [mintAccount, sourceAccount, destinationAccount, feePayerLamports, ataRent, blockhash] =
      await Promise.all([
        rpc.getAccount(intent.mintAddress),
        rpc.getAccount(intent.sourceTokenAccount),
        rpc.getAccount(intent.destinationTokenAccount),
        rpc.getLamports(intent.feePayerAddress),
        rpc.getMinimumBalanceForRentExemption(165),
        rpc.getLatestBlockhash()
      ]);
    if (!mintAccount || mintAccount.executable || !sourceAccount || sourceAccount.executable) {
      await failBeforeBroadcast("PAYOUT_REQUIRED_ACCOUNT_MISSING");
      return { outcome: "quarantined", payoutIntentId: intent.id, reason: "mint_or_source_account_missing" };
    }
    const mint = parseClassicSplMint({ owner: mintAccount.owner, dataBase64: mintAccount.dataBase64 });
    const source = parseClassicSplTokenAccount({ owner: sourceAccount.owner, dataBase64: sourceAccount.dataBase64 });
    if (
      source.mint !== intent.mintAddress ||
      source.owner !== intent.treasuryAuthorityAddress ||
      source.state !== "initialized" ||
      source.amountBaseUnits < intent.amountBaseUnits ||
      mint.decimals !== intent.decimals
    ) {
      return await quarantine("source_token_account_or_mint_invariant_mismatch");
    }
    if (destinationAccount) {
      if (destinationAccount.executable) return await quarantine("destination_account_is_executable");
      const destination = parseClassicSplTokenAccount({
        owner: destinationAccount.owner,
        dataBase64: destinationAccount.dataBase64
      });
      if (
        destination.mint !== intent.mintAddress ||
        destination.owner !== intent.destinationWallet ||
        destination.state !== "initialized"
      ) return await quarantine("destination_ata_owner_mint_or_state_mismatch");
    }
    if (!isSafeLamports(feePayerLamports) || !isSafeLamports(ataRent)) {
      await failBeforeBroadcast("PAYOUT_INVALID_FEE_BUDGET");
      return { outcome: "quarantined", payoutIntentId: intent.id, reason: "invalid_fee_payer_budget" };
    }

    const built = await buildClassicSplTransferTransaction({
      feePayerAddress: intent.feePayerAddress,
      treasuryAuthorityAddress: intent.treasuryAuthorityAddress,
      destinationOwnerAddress: intent.destinationWallet,
      mintAddress: intent.mintAddress,
      amountBaseUnits: intent.amountBaseUnits,
      decimals: intent.decimals,
      recentBlockhash: blockhash.blockhash,
      lastValidBlockHeight: BigInt(blockhash.lastValidBlockHeight)
    });
    if (
      built.sourceTokenAccount !== intent.sourceTokenAccount ||
      built.destinationTokenAccount !== intent.destinationTokenAccount
    ) return await quarantine("derived_associated_token_account_mismatch");

    const fee = await rpc.getFeeForTransaction(built.transactionBase64);
    const requiredLamports = fee + (destinationAccount ? 0 : ataRent);
    if (!isSafeLamports(fee) || !Number.isSafeInteger(requiredLamports) ||
        requiredLamports < 0 || feePayerLamports < requiredLamports) {
      await failBeforeBroadcast("PAYOUT_FEE_PAYER_INSUFFICIENT_SOL");
      return { outcome: "quarantined", payoutIntentId: intent.id, reason: "fee_payer_sol_budget_insufficient" };
    }
    const simulation = await rpc.simulateTransaction(built.transactionBase64);
    if (simulation.err !== null) {
      await failBeforeBroadcast("PAYOUT_SIMULATION_FAILED");
      return { outcome: "quarantined", payoutIntentId: intent.id, reason: "unsigned_transaction_simulation_failed" };
    }

    const signingRequest = {
      network: "devnet" as const,
      genesisHash: SOLANA_DEVNET_GENESIS_HASH,
      signerProvider: intent.signerProvider,
      signerKeyReference: intent.signerKeyReference,
      unsignedTransactionBase64: built.transactionBase64,
      mintAddress: intent.mintAddress,
      tokenProgram: intent.tokenProgram,
      sourceOwnerAddress: intent.treasuryAuthorityAddress,
      sourceTokenAccount: intent.sourceTokenAccount,
      destinationOwnerAddress: intent.destinationWallet,
      destinationTokenAccount: intent.destinationTokenAccount,
      feePayerAddress: intent.feePayerAddress,
      amountBaseUnits: intent.amountBaseUnits.toString(),
      maxSinglePayoutBaseUnits: intent.maxSinglePayoutBaseUnits.toString(),
      remainingRollingOutflowBaseUnits: intent.remainingRollingOutflowBaseUnits.toString(),
      decimals: intent.decimals
    };
    validateBgPayoutSigningRequest(signingRequest);
    const signed = await signer.sign(signingRequest);
    if (!signed.transactionSignature || !signed.signedTransactionBase64) {
      return await quarantine("signer_returned_incomplete_signed_transaction");
    }
    const persisted = await repository.persistSigned({
      payoutIntentId: intent.id,
      signature: signed.transactionSignature,
      recentBlockhash: blockhash.blockhash,
      lastValidBlockHeight: BigInt(blockhash.lastValidBlockHeight)
    });
    if (!persisted) return await quarantine("signed_transaction_could_not_be_persisted_before_broadcast");
    persistedSignature = signed.transactionSignature;

    let rpcSignature: string;
    try {
      rpcSignature = await rpc.sendRawTransaction(signed.signedTransactionBase64);
    } catch {
      await repository.transition({
        payoutIntentId: intent.id,
        from: "signed",
        to: "reconciliation_required",
        signature: persistedSignature,
        errorCode: "PAYOUT_BROADCAST_OUTCOME_AMBIGUOUS",
        evidence: { broadcastOutcomeAmbiguous: true, signature: persistedSignature }
      });
      return { outcome: "reconciliation_required", payoutIntentId: intent.id, signature: persistedSignature };
    }
    if (rpcSignature !== persistedSignature) {
      await repository.transition({
        payoutIntentId: intent.id,
        from: "signed",
        to: "quarantined",
        signature: persistedSignature,
        errorCode: "PAYOUT_RPC_SIGNATURE_MISMATCH",
        evidence: { integrityMismatch: true, rpcSignature, signerSignature: persistedSignature }
      });
      return { outcome: "quarantined", payoutIntentId: intent.id, reason: "rpc_signature_does_not_match_signed_transaction" };
    }
    await repository.transition({
      payoutIntentId: intent.id,
      from: "signed",
      to: "submitted",
      signature: persistedSignature,
      evidence: { broadcastAccepted: true }
    });

    const status = await rpc.getSignatureStatus(persistedSignature);
    if (status.err !== null) {
      await repository.transition({
        payoutIntentId: intent.id,
        from: "submitted",
        to: "failed",
        signature: persistedSignature,
        errorCode: "PAYOUT_CHAIN_TRANSACTION_FAILED",
        evidence: { definitiveFailureVerified: true, chainError: status.err }
      });
      return { outcome: "reconciliation_required", payoutIntentId: intent.id, signature: persistedSignature };
    }
    if (status.confirmationStatus === "processed" || status.confirmationStatus === "confirmed") {
      const to = status.confirmationStatus;
      await repository.transition({
        payoutIntentId: intent.id,
        from: "submitted",
        to,
        signature: persistedSignature,
        ...(status.slot === null ? {} : { slot: BigInt(status.slot) }),
        evidence: { chainObservation: to }
      });
      return to === "confirmed" && status.slot !== null
        ? { outcome: "confirmed", payoutIntentId: intent.id, signature: persistedSignature, slot: BigInt(status.slot) }
        : { outcome: "submitted", payoutIntentId: intent.id, signature: persistedSignature };
    }
    if (status.confirmationStatus !== "finalized" || status.slot === null) {
      await repository.transition({
        payoutIntentId: intent.id,
        from: "submitted",
        to: "reconciliation_required",
        signature: persistedSignature,
        errorCode: "PAYOUT_FINALITY_NOT_ESTABLISHED",
        evidence: { chainObservation: "unknown" }
      });
      return { outcome: "reconciliation_required", payoutIntentId: intent.id, signature: persistedSignature };
    }
    const finalizedTransaction = await rpc.getFinalizedTransaction(persistedSignature);
    const finalizedSlot = finalizedTransaction === null
      ? null
      : hasExactFinalizedTransfer(finalizedTransaction, persistedSignature, intent);
    if (finalizedSlot === null || finalizedSlot !== BigInt(status.slot)) {
      await repository.transition({
        payoutIntentId: intent.id,
        from: "submitted",
        to: "quarantined",
        signature: persistedSignature,
        errorCode: "PAYOUT_FINALIZED_TRANSFER_MISMATCH",
        evidence: { integrityMismatch: true, expectedSlot: status.slot }
      });
      return { outcome: "quarantined", payoutIntentId: intent.id, reason: "finalized_transaction_did_not_match_exact_payout_intent" };
    }
    await repository.transition({
      payoutIntentId: intent.id,
      from: "submitted",
      to: "finalized",
      signature: persistedSignature,
      slot: finalizedSlot,
      evidence: { finalizedTransferVerified: true }
    });
    const settled = await repository.settleFinalizedPayoutOnce({
      payoutIntentId: intent.id,
      signature: persistedSignature,
      finalizedSlot
    });
    return settled
      ? { outcome: "paid", payoutIntentId: intent.id, signature: persistedSignature, slot: finalizedSlot }
      : { outcome: "reconciliation_required", payoutIntentId: intent.id, signature: persistedSignature };
  } catch (error) {
    if (persistedSignature) {
      await repository.transition({
        payoutIntentId: intent.id,
        from: "signed",
        to: "reconciliation_required",
        signature: persistedSignature,
        errorCode: "PAYOUT_EXECUTION_INTERRUPTED_AFTER_SIGNING",
        evidence: { broadcastOutcomeAmbiguous: true, signature: persistedSignature }
      });
      return { outcome: "reconciliation_required", payoutIntentId: intent.id, signature: persistedSignature };
    }
    await failBeforeBroadcast("PAYOUT_PREFLIGHT_OR_SIGNING_FAILED");
    throw error;
  }
}
