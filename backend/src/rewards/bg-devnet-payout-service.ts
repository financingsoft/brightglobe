import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  bgTreasuryReconciliationRuns,
  rewardAuditEvents,
  rewardEvents,
  rewardPayoutIntents,
  rewardPrograms,
  treasuryAccounts
} from "../db/schema.js";
import { SOLANA_DEVNET_GENESIS_HASH, type SolanaGateway } from "../blockchain/solana/gateway.js";
import { decodeSolanaAddress, isValidSolanaAddress } from "../blockchain/solana/address.js";
import { verifySolanaMessageSignature } from "../blockchain/solana/signature.js";
import {
  CLASSIC_SPL_TOKEN_PROGRAM_ID,
  parseClassicSplMint,
  parseClassicSplTokenAccount
} from "../blockchain/solana/token/classic-token.js";
import {
  buildClassicSplTransferTransaction,
  deriveClassicSplAssociatedTokenAddress
} from "../blockchain/solana/transfer-builder.js";
import { decodeFinalizedClassicTokenEvents } from "../blockchain/solana/transaction-decoder.js";
import {
  findMatchingFinalizedTransferEvent,
  matchesFinalizedTransactionEnvelope
} from "../indexer/transaction-verifier.js";
import { hasBlockhashExpired } from "../assets/transactions/blockhash.js";
import { createUuidV7 } from "../identity/ids.js";

const U64_MAX = 18_446_744_073_709_551_615n;
const DEFAULT_LEASE_MS = 90_000;
const DEFAULT_RETRY_MS = 30_000;
const DEFAULT_BATCH_LIMIT = 10;

export type BgDevnetPayoutSignerProvider = "devnet_local" | "kms" | "hsm" | "external";

export interface BgDevnetTransferPolicy {
  network: "devnet";
  mintAddress: string;
  tokenProgram: typeof CLASSIC_SPL_TOKEN_PROGRAM_ID;
  sourceTokenAccount: string;
  sourceOwnerAddress: string;
  feePayerAddress: string;
  destinationWallet: string;
  destinationTokenAccount: string;
  amountBaseUnits: string;
  decimals: number;
  hotWalletCapBaseUnits: string;
}

export interface BgDevnetPayoutSigner {
  provider: BgDevnetPayoutSignerProvider;
  keyReference: string;
  signTransaction(input: {
    network: "devnet";
    unsignedTransactionBase64: string;
    requiredSigners: readonly string[];
    policy: BgDevnetTransferPolicy;
  }): Promise<{ signedTransactionBase64: string }>;
}

export type BgDevnetPayoutStatus =
  | "queued"
  | "signing"
  | "signed"
  | "submitted"
  | "confirmed"
  | "finalized"
  | "paid"
  | "failed"
  | "quarantined"
  | "cancelled"
  | "reconciliation_required"
  | "busy"
  | "not_found";

export interface BgDevnetPayoutResult {
  payoutIntentId: string;
  status: BgDevnetPayoutStatus;
  signature?: string | null;
  reasonCode?: string;
}

type PayoutContext = {
  payout: typeof rewardPayoutIntents.$inferSelect;
  event: typeof rewardEvents.$inferSelect;
  program: typeof rewardPrograms.$inferSelect;
  asset: typeof assetRegistry.$inferSelect;
  treasury: typeof treasuryAccounts.$inferSelect;
};

class PayoutQuarantineError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PayoutQuarantineError";
  }
}

class PayoutDeferredError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PayoutDeferredError";
  }
}

function decodeBase58(value: string, expectedLength: number): Uint8Array | null {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const indexes = new Map([...alphabet].map((character, index) => [character, BigInt(index)]));
  if (typeof value !== "string" || value.length === 0 || value.length > 128) return null;
  let number = 0n;
  for (const character of value) {
    const digit = indexes.get(character);
    if (digit === undefined) return null;
    number = number * 58n + digit;
  }
  const leadingZeroes = value.match(/^1*/)?.[0].length ?? 0;
  const decoded: number[] = [];
  while (number > 0n) {
    decoded.push(Number(number & 0xffn));
    number >>= 8n;
  }
  decoded.reverse();
  const bytes = new Uint8Array(leadingZeroes + decoded.length);
  bytes.set(decoded, leadingZeroes);
  return bytes.length === expectedLength ? bytes : null;
}

function encodeBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const byte of bytes) number = number * 256n + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    const remainder = Number(number % 58n);
    encoded = alphabet[remainder]! + encoded;
    number /= 58n;
  }
  const leadingZeroes = bytes.findIndex((byte) => byte !== 0);
  return "1".repeat(leadingZeroes === -1 ? bytes.length : leadingZeroes) + encoded;
}

function decodeBase64(value: string): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new PayoutQuarantineError("SIGNED_TRANSACTION_BASE64_INVALID");
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new PayoutQuarantineError("SIGNED_TRANSACTION_BASE64_INVALID");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeShortVector(bytes: Uint8Array, start: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let offset = start;
  for (let index = 0; index < 3; index += 1) {
    const byte = bytes[offset++];
    if (byte === undefined) throw new PayoutQuarantineError("SIGNED_TRANSACTION_FORMAT_INVALID");
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, next: offset };
    shift += 7;
  }
  throw new PayoutQuarantineError("SIGNED_TRANSACTION_FORMAT_INVALID");
}

function splitWireTransaction(bytes: Uint8Array): { signatures: Uint8Array[]; message: Uint8Array } {
  const count = decodeShortVector(bytes, 0);
  if (count.value < 1 || count.value > 4) throw new PayoutQuarantineError("SIGNED_TRANSACTION_SIGNER_COUNT_INVALID");
  const signatureStart = count.next;
  const messageStart = signatureStart + count.value * 64;
  if (messageStart >= bytes.length) throw new PayoutQuarantineError("SIGNED_TRANSACTION_FORMAT_INVALID");
  const signatures: Uint8Array[] = [];
  for (let index = 0; index < count.value; index += 1) {
    signatures.push(bytes.slice(signatureStart + index * 64, signatureStart + (index + 1) * 64));
  }
  return { signatures, message: bytes.slice(messageStart) };
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/**
 * Ensures the signer only adds valid signatures to the exact transaction message
 * constructed by BrightGlobe. It never accepts a changed message or extra signer.
 */
export async function verifyBgDevnetSignedTransaction(input: {
  unsignedTransactionBase64: string;
  signedTransactionBase64: string;
  requiredSigners: readonly string[];
}): Promise<{ signature: string }> {
  const unsignedBytes = decodeBase64(input.unsignedTransactionBase64);
  const signedBytes = decodeBase64(input.signedTransactionBase64);
  const unsigned = splitWireTransaction(unsignedBytes);
  const signed = splitWireTransaction(signedBytes);
  const uniqueSigners = [...new Set(input.requiredSigners)];

  if (
    uniqueSigners.length === 0 ||
    uniqueSigners.length > 4 ||
    signed.signatures.length !== uniqueSigners.length ||
    unsigned.signatures.length !== uniqueSigners.length ||
    !equalBytes(unsigned.message, signed.message)
  ) {
    throw new PayoutQuarantineError("SIGNED_TRANSACTION_IDENTITY_MISMATCH");
  }

  const message = signed.message;
  const versioned = (message[0]! & 0x80) !== 0;
  if (versioned && (message[0]! & 0x7f) !== 0) {
    throw new PayoutQuarantineError("SIGNED_TRANSACTION_VERSION_UNSUPPORTED");
  }
  const headerOffset = versioned ? 1 : 0;
  const requiredSignatureCount = message[headerOffset];
  if (requiredSignatureCount !== uniqueSigners.length) {
    throw new PayoutQuarantineError("SIGNED_TRANSACTION_SIGNER_COUNT_INVALID");
  }
  const accountCount = decodeShortVector(message, headerOffset + 3);
  const accountKeysStart = accountCount.next;
  if (accountCount.value < uniqueSigners.length || accountKeysStart + accountCount.value * 32 > message.length) {
    throw new PayoutQuarantineError("SIGNED_TRANSACTION_ACCOUNT_KEYS_INVALID");
  }

  for (let index = 0; index < uniqueSigners.length; index += 1) {
    const expectedKey = decodeSolanaAddress(uniqueSigners[index]!);
    const actualKey = message.slice(accountKeysStart + index * 32, accountKeysStart + (index + 1) * 32);
    const signature = signed.signatures[index]!;
    if (
      !expectedKey ||
      !equalBytes(expectedKey, actualKey) ||
      signature.length !== 64 ||
      signature.every((byte) => byte === 0) ||
      !(await verifySolanaMessageSignature(uniqueSigners[index]!, message, signature))
    ) {
      throw new PayoutQuarantineError("SIGNED_TRANSACTION_SIGNATURE_INVALID");
    }
  }

  return { signature: encodeBase58(signed.signatures[0]!) };
}

async function loadPayoutContext(db: Database, payoutIntentId: string): Promise<PayoutContext | null> {
  const [row] = await db.select({
    payout: rewardPayoutIntents,
    event: rewardEvents,
    program: rewardPrograms,
    asset: assetRegistry,
    treasury: treasuryAccounts
  }).from(rewardPayoutIntents)
    .innerJoin(rewardEvents, eq(rewardEvents.id, rewardPayoutIntents.rewardEventId))
    .innerJoin(rewardPrograms, eq(rewardPrograms.id, rewardEvents.programId))
    .innerJoin(assetRegistry, eq(assetRegistry.id, rewardPrograms.assetId))
    .innerJoin(treasuryAccounts, eq(treasuryAccounts.id, rewardPayoutIntents.treasuryAccountId))
    .where(eq(rewardPayoutIntents.id, payoutIntentId))
    .limit(1);
  return row ?? null;
}

async function claimPayout(
  db: Database,
  payoutIntentId: string,
  now: Date,
  leaseMs: number
): Promise<{ kind: "claimed"; status: string } | { kind: "busy"; status: string } | { kind: "terminal"; status: string } | { kind: "not_found" }> {
  return db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout) return { kind: "not_found" as const };
    if (["paid", "failed", "quarantined", "cancelled", "reconciliation_required"].includes(payout.status)) {
      return { kind: "terminal" as const, status: payout.status };
    }
    if (payout.retryAfter && payout.retryAfter > now) {
      return { kind: "busy" as const, status: payout.status };
    }
    const status = payout.status === "queued" ? "signing" : payout.status;
    await tx.update(rewardPayoutIntents).set({
      status,
      retryAfter: new Date(now.getTime() + leaseMs),
      attemptCount: payout.attemptCount + 1,
      lastAttemptAt: now,
      updatedAt: now
    }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    return { kind: "claimed" as const, status };
  });
}

function makeAuditEvent(input: {
  id: string;
  action: string;
  payoutIntentId: string;
  reason: string;
  metadata: Record<string, unknown>;
  now: Date;
}) {
  return {
    id: input.id,
    actorType: "service" as const,
    actorId: null,
    action: input.action,
    targetType: "reward_payout_intent",
    targetId: input.payoutIntentId,
    reason: input.reason,
    metadata: input.metadata,
    createdAt: input.now
  };
}

async function retryPayout(db: Database, payoutIntentId: string, code: string, now: Date, retryMs: number): Promise<void> {
  await db.update(rewardPayoutIntents).set({
    lastErrorCode: code,
    retryAfter: new Date(now.getTime() + retryMs),
    updatedAt: now
  }).where(eq(rewardPayoutIntents.id, payoutIntentId));
}

async function markSubmitted(db: Database, payoutIntentId: string, signature: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout || ["paid", "failed", "quarantined", "cancelled"].includes(payout.status)) return;
    if (payout.chainSignature !== signature) {
      throw new PayoutQuarantineError("BROADCAST_SIGNATURE_MISMATCH");
    }
    if (payout.status === "signed") {
      await tx.update(rewardPayoutIntents).set({
        status: "submitted",
        submittedAt: payout.submittedAt ?? now,
        retryAfter: new Date(now.getTime() + DEFAULT_RETRY_MS),
        lastErrorCode: null,
        updatedAt: now
      }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    } else {
      await tx.update(rewardPayoutIntents).set({
        submittedAt: payout.submittedAt ?? now,
        retryAfter: new Date(now.getTime() + DEFAULT_RETRY_MS),
        lastErrorCode: null,
        updatedAt: now
      }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    }
    const [event] = await tx.select().from(rewardEvents)
      .where(eq(rewardEvents.id, payout.rewardEventId))
      .limit(1)
      .for("update");
    if (event?.status === "reserved") {
      await tx.update(rewardEvents).set({ status: "submitted", updatedAt: now })
        .where(eq(rewardEvents.id, event.id));
    }
    await tx.insert(rewardAuditEvents).values(makeAuditEvent({
      id: createUuidV7(now.getTime()),
      action: "bg.reward.payout.submitted",
      payoutIntentId,
      reason: "The exact signed Devnet transaction was accepted by the RPC endpoint.",
      metadata: { signature, network: "devnet" },
      now
    }));
  });
}

async function markConfirmed(db: Database, payoutIntentId: string, signature: string, slot: bigint, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout || ["paid", "failed", "quarantined", "cancelled"].includes(payout.status)) return;
    if (payout.chainSignature !== signature) throw new PayoutQuarantineError("CONFIRMED_SIGNATURE_MISMATCH");
    if (payout.status === "submitted") {
      await tx.update(rewardPayoutIntents).set({
        status: "confirmed",
        confirmedSlot: slot,
        chainSlot: slot,
        retryAfter: new Date(now.getTime() + DEFAULT_RETRY_MS),
        lastErrorCode: null,
        updatedAt: now
      }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    } else if (payout.status === "confirmed") {
      await tx.update(rewardPayoutIntents).set({
        confirmedSlot: payout.confirmedSlot ?? slot,
        chainSlot: slot,
        retryAfter: new Date(now.getTime() + DEFAULT_RETRY_MS),
        lastErrorCode: null,
        updatedAt: now
      }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    }
    const [event] = await tx.select().from(rewardEvents)
      .where(eq(rewardEvents.id, payout.rewardEventId))
      .limit(1)
      .for("update");
    if (event?.status === "submitted") {
      await tx.update(rewardEvents).set({ status: "confirmed", updatedAt: now })
        .where(eq(rewardEvents.id, event.id));
    }
    await tx.insert(rewardAuditEvents).values(makeAuditEvent({
      id: createUuidV7(now.getTime()),
      action: "bg.reward.payout.confirmed",
      payoutIntentId,
      reason: "The Devnet transaction reached confirmed commitment.",
      metadata: { signature, slot: slot.toString(), network: "devnet" },
      now
    }));
  });
}

async function markReconciliationRequired(
  db: Database,
  payoutIntentId: string,
  code: string,
  now: Date,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout || ["paid", "failed", "quarantined", "cancelled", "reconciliation_required"].includes(payout.status)) return;
    await tx.update(rewardPayoutIntents).set({
      status: "reconciliation_required",
      lastErrorCode: code,
      retryAfter: null,
      reconciliationMetadata: { ...payout.reconciliationMetadata, ...metadata, reasonCode: code },
      updatedAt: now
    }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    const [event] = await tx.select().from(rewardEvents)
      .where(eq(rewardEvents.id, payout.rewardEventId))
      .limit(1)
      .for("update");
    if (event && !["paid", "failed", "quarantined", "cancelled"].includes(event.status)) {
      await tx.update(rewardEvents).set({ status: "reconciliation_required", updatedAt: now })
        .where(eq(rewardEvents.id, event.id));
    }
    await tx.insert(rewardAuditEvents).values(makeAuditEvent({
      id: createUuidV7(now.getTime()),
      action: "bg.reward.payout.reconciliation_required",
      payoutIntentId,
      reason: "The payout outcome is ambiguous; the reservation remains held pending reconciliation.",
      metadata: { reasonCode: code, ...metadata },
      now
    }));
  });
}

async function markQuarantined(
  db: Database,
  payoutIntentId: string,
  code: string,
  now: Date,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout || ["paid", "failed", "quarantined", "cancelled"].includes(payout.status)) return;
    await tx.update(rewardPayoutIntents).set({
      status: "quarantined",
      lastErrorCode: code,
      retryAfter: null,
      reconciliationMetadata: { ...payout.reconciliationMetadata, ...metadata, reasonCode: code },
      updatedAt: now
    }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    const [event] = await tx.select().from(rewardEvents)
      .where(eq(rewardEvents.id, payout.rewardEventId))
      .limit(1)
      .for("update");
    if (event && !["paid", "failed", "quarantined", "cancelled"].includes(event.status)) {
      await tx.update(rewardEvents).set({ status: "quarantined", updatedAt: now })
        .where(eq(rewardEvents.id, event.id));
    }
    await tx.insert(rewardAuditEvents).values(makeAuditEvent({
      id: createUuidV7(now.getTime()),
      action: "bg.reward.payout.quarantined",
      payoutIntentId,
      reason: "The signer, account, or finalized transaction did not match the immutable payout intent.",
      metadata: { reasonCode: code, ...metadata },
      now
    }));
  });
}

async function releaseReservedBudget(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  programId: string,
  amount: bigint,
  now: Date
): Promise<void> {
  const [program] = await tx.select().from(rewardPrograms)
    .where(eq(rewardPrograms.id, programId))
    .limit(1)
    .for("update");
  if (!program || program.reservedBaseUnits < amount) {
    throw new Error("BG reward reserved budget does not cover the terminal payout transition.");
  }
  await tx.update(rewardPrograms).set({
    reservedBaseUnits: program.reservedBaseUnits - amount,
    updatedAt: now
  }).where(eq(rewardPrograms.id, programId));
}

async function markFailed(db: Database, payoutIntentId: string, code: string, now: Date, metadata: Record<string, unknown> = {}): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout || ["paid", "failed", "quarantined", "cancelled"].includes(payout.status)) return;
    const [event] = await tx.select().from(rewardEvents)
      .where(eq(rewardEvents.id, payout.rewardEventId))
      .limit(1)
      .for("update");
    if (!event) throw new Error("BG reward event is missing.");
    await releaseReservedBudget(tx, event.programId, event.amountBaseUnits, now);
    await tx.update(rewardPayoutIntents).set({
      status: "failed",
      lastErrorCode: code,
      retryAfter: null,
      reconciliationMetadata: { ...payout.reconciliationMetadata, ...metadata, reasonCode: code },
      updatedAt: now
    }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    await tx.update(rewardEvents).set({ status: "failed", updatedAt: now })
      .where(eq(rewardEvents.id, event.id));
    await tx.insert(rewardAuditEvents).values(makeAuditEvent({
      id: createUuidV7(now.getTime()),
      action: "bg.reward.payout.failed",
      payoutIntentId,
      reason: "Finalized Solana evidence proves the reserved transfer failed.",
      metadata: { reasonCode: code, ...metadata },
      now
    }));
  });
}

async function markCancelled(db: Database, payoutIntentId: string, code: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout || payout.status !== "signing" || payout.chainSignature) return;
    const [event] = await tx.select().from(rewardEvents)
      .where(eq(rewardEvents.id, payout.rewardEventId))
      .limit(1)
      .for("update");
    if (!event || event.status !== "reserved") throw new Error("Only an unsubmitted reserved BG reward can be cancelled.");
    await releaseReservedBudget(tx, event.programId, event.amountBaseUnits, now);
    await tx.update(rewardPayoutIntents).set({
      status: "cancelled",
      lastErrorCode: code,
      retryAfter: null,
      updatedAt: now
    }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    await tx.update(rewardEvents).set({ status: "cancelled", updatedAt: now })
      .where(eq(rewardEvents.id, event.id));
    await tx.insert(rewardAuditEvents).values(makeAuditEvent({
      id: createUuidV7(now.getTime()),
      action: "bg.reward.payout.cancelled",
      payoutIntentId,
      reason: "The reward program or treasury was paused before any transaction was signed.",
      metadata: { reasonCode: code },
      now
    }));
  });
}

async function settlePaid(
  db: Database,
  payoutIntentId: string,
  signature: string,
  slot: bigint,
  verified: Record<string, unknown>,
  now: Date
): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout) throw new Error("BG reward payout intent is missing.");
    if (payout.status === "paid") return;
    if (payout.chainSignature !== signature) throw new Error("BG reward payout signature changed before settlement.");
    const [event] = await tx.select().from(rewardEvents)
      .where(eq(rewardEvents.id, payout.rewardEventId))
      .limit(1)
      .for("update");
    if (!event || event.amountBaseUnits !== payout.amountBaseUnits) {
      throw new Error("BG reward payout amount does not match its reward event.");
    }
    if (["failed", "quarantined", "cancelled"].includes(event.status)) {
      throw new Error("A terminal BG reward event cannot be paid.");
    }
    const [program] = await tx.select().from(rewardPrograms)
      .where(eq(rewardPrograms.id, event.programId))
      .limit(1)
      .for("update");
    if (!program || program.reservedBaseUnits < event.amountBaseUnits) {
      throw new Error("BG reward reserved budget does not cover finalized settlement.");
    }

    const finalizedAt = now;
    await tx.update(rewardPayoutIntents).set({
      status: "finalized",
      chainSlot: slot,
      confirmedSlot: payout.confirmedSlot ?? slot,
      finalizedSlot: slot,
      finalizedAt,
      retryAfter: null,
      lastErrorCode: null,
      reconciliationMetadata: { ...payout.reconciliationMetadata, finalizedTransfer: verified },
      updatedAt: now
    }).where(eq(rewardPayoutIntents.id, payoutIntentId);
    if (event.status !== "finalized") {
      await tx.update(rewardEvents).set({ status: "finalized", updatedAt: now })
        .where(eq(rewardEvents.id, event.id));
    }
    await tx.update(rewardEvents).set({ status: "paid", updatedAt: now })
      .where(eq(rewardEvents.id, event.id));
    await tx.update(rewardPayoutIntents).set({ status: "paid", updatedAt: now })
      .where(eq(rewardPayoutIntents.id, payoutIntentId));
    await tx.update(rewardPrograms).set({
      reservedBaseUnits: program.reservedBaseUnits - event.amountBaseUnits,
      paidBaseUnits: program.paidBaseUnits + event.amountBaseUnits,
      updatedAt: now
    }).where(eq(rewardPrograms.id, program.id));
    await tx.insert(rewardAuditEvents).values(makeAuditEvent({
      id: createUuidV7(now.getTime()),
      action: "bg.reward.payout.paid",
      payoutIntentId,
      reason: "The exact Classic SPL transfer was independently verified at finalized commitment.",
      metadata: {
        signature,
        slot: slot.toString(),
        amountBaseUnits: event.amountBaseUnits.toString(),
        network: "devnet",
        ...verified
      },
      now
    }));
  });
}

function validatePayoutContext(
  context: PayoutContext,
  signer: BgDevnetPayoutSigner,
  allowTestSigner: boolean
): { sourceOwnerAddress: string; requiredSigners: string[]; policy: BgDevnetTransferPolicy } {
  const { payout, event, program, asset, treasury } = context;
  if (
    payout.network !== "devnet" ||
    asset.network !== "devnet" ||
    treasury.network !== "devnet" ||
    asset.assetCode !== "BG"
  ) {
    throw new PayoutQuarantineError("PAYOUT_NETWORK_OR_ASSET_MISMATCH");
  }
  if (
    asset.status !== "active" ||
    asset.metadataSource !== "verified" ||
    asset.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
    !asset.mintAddress ||
    asset.decimals === null ||
    payout.mintAddress !== asset.mintAddress ||
    payout.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
    treasury.mintAddress !== asset.mintAddress
  ) {
    throw new PayoutQuarantineError("PAYOUT_MINT_CONFIGURATION_MISMATCH");
  }
  if (
    !treasury.treasuryWalletAddress ||
    !treasury.tokenAccountAddress ||
    !treasury.feePayerAddress ||
    !isValidSolanaAddress(treasury.treasuryWalletAddress) ||
    !isValidSolanaAddress(treasury.tokenAccountAddress) ||
    !isValidSolanaAddress(treasury.feePayerAddress) ||
    payout.feePayerAddress !== treasury.feePayerAddress ||
    payout.sourceTokenAccount !== treasury.tokenAccountAddress
  ) {
    throw new PayoutQuarantineError("PAYOUT_TREASURY_CONFIGURATION_MISMATCH");
  }
  if (
    !isValidSolanaAddress(payout.destinationWallet) ||
    !isValidSolanaAddress(payout.destinationTokenAccount) ||
    payout.destinationWallet === treasury.treasuryWalletAddress ||
    payout.amountBaseUnits <= 0n ||
    payout.amountBaseUnits > U64_MAX ||
    payout.amountBaseUnits !== event.amountBaseUnits ||
    treasury.hotWalletCapBaseUnits < payout.amountBaseUnits ||
    event.programId !== program.id ||
    program.assetId !== asset.id ||
    program.actionType !== event.actionType
  ) {
    throw new PayoutQuarantineError("PAYOUT_IMMUTABLE_IDENTITY_MISMATCH");
  }
  if (
    !treasury.signerKeyReference ||
    treasury.signerProvider === "unconfigured"
  ) {
    throw new PayoutDeferredError("SIGNER_NOT_CONFIGURED");
  }
  if (
    signer.provider !== treasury.signerProvider ||
    signer.keyReference !== treasury.signerKeyReference
  ) {
    throw new PayoutQuarantineError("SIGNER_POLICY_REFERENCE_MISMATCH");
  }
  if (signer.provider === "devnet_local" && !allowTestSigner) {
    throw new PayoutQuarantineError("LOCAL_SIGNER_FORBIDDEN_OUTSIDE_TESTS");
  }
  if (typeof signer.signTransaction !== "function") {
    throw new PayoutDeferredError("SIGNER_UNAVAILABLE");
  }

  const requiredSigners = [...new Set([payout.feePayerAddress, treasury.treasuryWalletAddress])];
  return {
    sourceOwnerAddress: treasury.treasuryWalletAddress,
    requiredSigners,
    policy: {
      network: "devnet",
      mintAddress: asset.mintAddress,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      sourceTokenAccount: payout.sourceTokenAccount,
      sourceOwnerAddress: treasury.treasuryWalletAddress,
      feePayerAddress: payout.feePayerAddress,
      destinationWallet: payout.destinationWallet,
      destinationTokenAccount: payout.destinationTokenAccount,
      amountBaseUnits: payout.amountBaseUnits.toString(),
      decimals: asset.decimals,
      hotWalletCapBaseUnits: treasury.hotWalletCapBaseUnits.toString()
    }
  };
}

async function verifyMintAndTokenAccounts(
  context: PayoutContext,
  gateway: SolanaGateway,
  requireSourceBalance: boolean
): Promise<void> {
  const { payout, asset, treasury } = context;
  const mintAddress = asset.mintAddress!;
  const [mintInfo, sourceInfo, destinationInfo, feePayerInfo] = await Promise.all([
    gateway.getAccountInfo(mintAddress, "finalized"),
    gateway.getAccountInfo(payout.sourceTokenAccount, "finalized"),
    gateway.getAccountInfo(payout.destinationTokenAccount, "finalized"),
    gateway.getAccountInfo(payout.feePayerAddress, "confirmed")
  ]);
  if (!mintInfo.account) throw new PayoutQuarantineError("BG_MINT_ACCOUNT_MISSING");
  const mint = parseClassicSplMint({
    owner: mintInfo.account.owner,
    dataBase64: mintInfo.account.data[0]
  });
  if (!mint.initialized || mint.decimals !== asset.decimals) {
    throw new PayoutQuarantineError("BG_MINT_ACCOUNT_MISMATCH");
  }
  if (!sourceInfo.account) throw new PayoutQuarantineError("TREASURY_TOKEN_ACCOUNT_MISSING");
  const source = parseClassicSplTokenAccount({
    owner: sourceInfo.account.owner,
    dataBase64: sourceInfo.account.data[0]
  });
  if (
    source.owner !== treasury.treasuryWalletAddress ||
    source.mint !== mintAddress ||
    source.state !== "initialized"
  ) {
    throw new PayoutQuarantineError("TREASURY_TOKEN_ACCOUNT_MISMATCH");
  }
  if (requireSourceBalance && source.amountBaseUnits < payout.amountBaseUnits) {
    throw new PayoutDeferredError("TREASURY_BALANCE_INSUFFICIENT");
  }
  if (destinationInfo.account) {
    const destination = parseClassicSplTokenAccount({
      owner: destinationInfo.account.owner,
      dataBase64: destinationInfo.account.data[0]
    });
    if (
      destination.owner !== payout.destinationWallet ||
      destination.mint !== mintAddress ||
      destination.state !== "initialized"
    ) {
      throw new PayoutQuarantineError("DESTINATION_TOKEN_ACCOUNT_MISMATCH");
    }
  }
  if (!feePayerInfo.account || feePayerInfo.account.lamports <= 0) {
    throw new PayoutDeferredError("FEE_PAYER_SOL_BALANCE_MISSING");
  }
}

async function signTransaction(
  signer: BgDevnetPayoutSigner,
  unsignedTransactionBase64: string,
  requiredSigners: readonly string[],
  policy: BgDevnetTransferPolicy
): Promise<{ signedTransactionBase64: string; signature: string }> {
  let signed: { signedTransactionBase64: string };
  try {
    signed = await signer.signTransaction({
      network: "devnet",
      unsignedTransactionBase64,
      requiredSigners,
      policy
    });
  } catch {
    throw new PayoutDeferredError("SIGNER_UNAVAILABLE");
  }
  const verified = await verifyBgDevnetSignedTransaction({
    unsignedTransactionBase64,
    signedTransactionBase64: signed.signedTransactionBase64,
    requiredSigners
  });
  return { signedTransactionBase64: signed.signedTransactionBase64, signature: verified.signature };
}

async function persistSignedTransaction(
  db: Database,
  payoutIntentId: string,
  signed: { signature: string; recentBlockhash: string; lastValidBlockHeight: bigint },
  now: Date
): Promise<void> {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, payoutIntentId))
      .limit(1)
      .for("update");
    if (!payout) throw new Error("BG payout intent disappeared before signature persistence.");
    if (payout.chainSignature && (
      payout.chainSignature !== signed.signature ||
      payout.recentBlockhash !== signed.recentBlockhash ||
      payout.lastValidBlockHeight !== signed.lastValidBlockHeight
    )) {
      throw new PayoutQuarantineError("PAYOUT_SIGNATURE_REPLACEMENT_FORBIDDEN");
    }
    if (payout.status === "signing" && !payout.chainSignature) {
      await tx.update(rewardPayoutIntents).set({
        status: "signed",
        chainSignature: signed.signature,
        recentBlockhash: signed.recentBlockhash,
        lastValidBlockHeight: signed.lastValidBlockHeight,
        retryAfter: new Date(now.getTime() + DEFAULT_LEASE_MS),
        lastErrorCode: null,
        updatedAt: now
      }).where(eq(rewardPayoutIntents.id, payoutIntentId));
      await tx.insert(rewardAuditEvents).values(makeAuditEvent({
        id: createUuidV7(now.getTime()),
        action: "bg.reward.payout.signed",
        payoutIntentId,
        reason: "The exact Devnet transaction identity was persisted before broadcast.",
        metadata: {
          signature: signed.signature,
          recentBlockhash: signed.recentBlockhash,
          lastValidBlockHeight: signed.lastValidBlockHeight.toString(),
          network: "devnet"
        },
        now
      }));
    } else if (payout.chainSignature === signed.signature) {
      await tx.update(rewardPayoutIntents).set({
        retryAfter: new Date(now.getTime() + DEFAULT_LEASE_MS),
        lastErrorCode: null,
        updatedAt: now
      }).where(eq(rewardPayoutIntents.id, payoutIntentId));
    }
  });
}

async function buildUnsignedTransaction(
  context: PayoutContext,
  sourceOwnerAddress: string,
  recentBlockhash: string,
  lastValidBlockHeight: bigint
): Promise<{ transactionBase64: string; sourceTokenAccount: string; destinationTokenAccount: string }> {
  const { payout, asset } = context;
  const built = await buildClassicSplTransferTransaction({
    feePayerAddress: payout.feePayerAddress,
    sourceOwnerAddress,
    destinationOwnerAddress: payout.destinationWallet,
    mintAddress: payout.mintAddress,
    amountBaseUnits: payout.amountBaseUnits,
    decimals: asset.decimals!,
    recentBlockhash,
    lastValidBlockHeight
  });
  if (
    built.sourceTokenAccount !== payout.sourceTokenAccount ||
    built.destinationTokenAccount !== payout.destinationTokenAccount
  ) {
    throw new PayoutQuarantineError("DERIVED_TOKEN_ACCOUNT_MISMATCH");
  }
  return built;
}

async function verifyFinalizedTransfer(
  context: PayoutContext,
  gateway: SolanaGateway,
  signature: string,
  slot: bigint
): Promise<{ valid: true; metadata: Record<string, unknown> } | { valid: false; retryable: true } | { valid: false; retryable: false; code: string }> {
  const { payout, asset, treasury } = context;
  const transaction = await gateway.getTransaction(signature);
  if (!transaction) return { valid: false, retryable: true };
  if (!payout.recentBlockhash || !matchesFinalizedTransactionEnvelope(
    transaction,
    signature,
    payout.recentBlockhash,
    slot
  )) {
    return { valid: false, retryable: false, code: "FINALIZED_TRANSACTION_ENVELOPE_MISMATCH" };
  }
  const events = decodeFinalizedClassicTokenEvents(signature, transaction);
  if (events.length !== 1 || events[0]?.eventType !== "transfer") {
    return { valid: false, retryable: false, code: "FINALIZED_TOKEN_INSTRUCTION_MISMATCH" };
  }
  const matching = findMatchingFinalizedTransferEvent(events, {
    fromAddress: treasury.treasuryWalletAddress!,
    toAddress: payout.destinationWallet,
    amountBaseUnits: payout.amountBaseUnits,
    mintAddress: asset.mintAddress!,
    slot
  }, new Set([payout.sourceTokenAccount]), new Set([payout.destinationTokenAccount]));
  if (
    !matching ||
    matching.payload.mint !== asset.mintAddress ||
    matching.payload.originalType !== "transferChecked"
  ) {
    return { valid: false, retryable: false, code: "FINALIZED_TRANSFER_MISMATCH" };
  }

  const [mintInfo, sourceInfo, destinationInfo] = await Promise.all([
    gateway.getAccountInfo(asset.mintAddress!, "finalized"),
    gateway.getAccountInfo(payout.sourceTokenAccount, "finalized"),
    gateway.getAccountInfo(payout.destinationTokenAccount, "finalized")
  ]);
  if (!mintInfo.account || !sourceInfo.account || !destinationInfo.account) {
    return { valid: false, retryable: true };
  }
  try {
    const mint = parseClassicSplMint({
      owner: mintInfo.account.owner,
      dataBase64: mintInfo.account.data[0]
    });
    const source = parseClassicSplTokenAccount({
      owner: sourceInfo.account.owner,
      dataBase64: sourceInfo.account.data[0]
    });
    const destination = parseClassicSplTokenAccount({
      owner: destinationInfo.account.owner,
      dataBase64: destinationInfo.account.data[0]
    });
    if (
      mint.decimals !== asset.decimals ||
      source.owner !== treasury.treasuryWalletAddress ||
      source.mint !== asset.mintAddress ||
      source.state !== "initialized" ||
      destination.owner !== payout.destinationWallet ||
      destination.mint !== asset.mintAddress ||
      destination.state !== "initialized"
    ) {
      return { valid: false, retryable: false, code: "FINALIZED_TOKEN_ACCOUNT_MISMATCH" };
    }
  } catch {
    return { valid: false, retryable: false, code: "FINALIZED_TOKEN_ACCOUNT_INVALID" };
  }

  return {
    valid: true,
    metadata: {
      signature,
      slot: slot.toString(),
      mintAddress: asset.mintAddress,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      sourceTokenAccount: payout.sourceTokenAccount,
      destinationTokenAccount: payout.destinationTokenAccount,
      destinationWallet: payout.destinationWallet,
      amountBaseUnits: payout.amountBaseUnits.toString()
    }
  };
}

async function processExistingSignature(
  db: Database,
  context: PayoutContext,
  gateway: SolanaGateway,
  signer: BgDevnetPayoutSigner,
  input: { now: Date; leaseMs: number; retryMs: number; allowTestSigner: boolean }
): Promise<BgDevnetPayoutResult> {
  const { payout, treasury } = context;
  const signature = payout.chainSignature;
  if (
    !signature ||
    !decodeBase58(signature, 64) ||
    !payout.recentBlockhash ||
    payout.lastValidBlockHeight === null
  ) {
    await markQuarantined(db, payout.id, "SIGNED_PAYOUT_IDENTITY_INCOMPLETE", input.now);
    return { payoutIntentId: payout.id, status: "quarantined", reasonCode: "SIGNED_PAYOUT_IDENTITY_INCOMPLETE" };
  }

  const validated = validatePayoutContext(context, signer, input.allowTestSigner);
  const statusResponse = await gateway.getSignatureStatuses([signature]);
  const status = statusResponse.value[0];
  if (!status) {
    const blockHeight = BigInt(await gateway.getBlockHeight("confirmed"));
    if (hasBlockhashExpired(blockHeight, payout.lastValidBlockHeight)) {
      await markReconciliationRequired(db, payout.id, "BLOCKHASH_EXPIRED_WITHOUT_FINALIZED_EVIDENCE", input.now, {
        signature,
        lastValidBlockHeight: payout.lastValidBlockHeight.toString(),
        observedBlockHeight: blockHeight.toString()
      });
      return { payoutIntentId: payout.id, status: "reconciliation_required", signature, reasonCode: "BLOCKHASH_EXPIRED_WITHOUT_FINALIZED_EVIDENCE" };
    }
    const built = await buildUnsignedTransaction(
      context,
      validated.sourceOwnerAddress,
      payout.recentBlockhash,
      payout.lastValidBlockHeight
    );
    const signed = await signTransaction(signer, built.transactionBase64, validated.requiredSigners, validated.policy);
    if (signed.signature !== signature) {
      await markQuarantined(db, payout.id, "RETRY_SIGNATURE_CHANGED", input.now);
      return { payoutIntentId: payout.id, status: "quarantined", signature, reasonCode: "RETRY_SIGNATURE_CHANGED" };
    }
    try {
      const accepted = await gateway.sendTransaction(signed.signedTransactionBase64);
      if (accepted !== signature) {
        await markQuarantined(db, payout.id, "BROADCAST_SIGNATURE_MISMATCH", input.now);
        return { payoutIntentId: payout.id, status: "quarantined", signature, reasonCode: "BROADCAST_SIGNATURE_MISMATCH" };
      }
      await markSubmitted(db, payout.id, signature, input.now);
      return { payoutIntentId: payout.id, status: "submitted", signature };
    } catch {
      await retryPayout(db, payout.id, "BROADCAST_RETRY_PENDING", input.now, input.retryMs);
      return { payoutIntentId: payout.id, status: payout.status as BgDevnetPayoutStatus, signature, reasonCode: "BROADCAST_RETRY_PENDING" };
    }
  }

  if (status.err !== null && status.confirmationStatus === "finalized") {
    await markFailed(db, payout.id, "FINALIZED_TRANSACTION_FAILED", input.now, {
      signature,
      slot: status.slot.toString()
    });
    return { payoutIntentId: payout.id, status: "failed", signature, reasonCode: "FINALIZED_TRANSACTION_FAILED" };
  }
  if (status.confirmationStatus === "confirmed" && status.err === null) {
    await markConfirmed(db, payout.id, signature, BigInt(status.slot), input.now);
    return { payoutIntentId: payout.id, status: "confirmed", signature };
  }
  if (status.confirmationStatus === "finalized" && status.err === null) {
    const verification = await verifyFinalizedTransfer(context, gateway, signature, BigInt(status.slot));
    if (!verification.valid) {
      if (verification.retryable) {
        await retryPayout(db, payout.id, "FINALIZED_TRANSACTION_DATA_UNAVAILABLE", input.now, input.retryMs);
        return { payoutIntentId: payout.id, status: payout.status as BgDevnetPayoutStatus, signature, reasonCode: "FINALIZED_TRANSACTION_DATA_UNAVAILABLE" };
      }
      await markQuarantined(db, payout.id, verification.code, input.now, { signature, slot: status.slot.toString() });
      return { payoutIntentId: payout.id, status: "quarantined", signature, reasonCode: verification.code };
    }
    await settlePaid(db, payout.id, signature, BigInt(status.slot), verification.metadata, input.now);
    return { payoutIntentId: payout.id, status: "paid", signature };
  }

  await retryPayout(db, payout.id, "CHAIN_CONFIRMATION_PENDING", input.now, input.retryMs);
  return { payoutIntentId: payout.id, status: payout.status as BgDevnetPayoutStatus, signature, reasonCode: "CHAIN_CONFIRMATION_PENDING" };
}

/**
 * Processes one already-reserved payout. It never creates a reward, chooses an
 * amount, or accepts a destination from a caller. All transfer identity comes
 * from the immutable payout intent and its linked treasury/program records.
 */
export async function processBgDevnetPayoutIntent(
  db: Database,
  gateway: SolanaGateway,
  signer: BgDevnetPayoutSigner,
  input: {
    payoutIntentId: string;
    now?: Date;
    leaseMs?: number;
    retryMs?: number;
    allowTestSigner?: boolean;
  }
): Promise<BgDevnetPayoutResult> {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  const retryMs = input.retryMs ?? DEFAULT_RETRY_MS;
  if (
    !input.payoutIntentId ||
    Number.isNaN(now.getTime()) ||
    !Number.isInteger(leaseMs) || leaseMs < 10_000 || leaseMs > 300_000 ||
    !Number.isInteger(retryMs) || retryMs < 1_000 || retryMs > 300_000
  ) {
    throw new TypeError("A valid payout intent, timestamp, lease and retry interval are required.");
  }

  const claim = await claimPayout(db, input.payoutIntentId, now, leaseMs);
  if (claim.kind === "not_found") return { payoutIntentId: input.payoutIntentId, status: "not_found" };
  if (claim.kind === "busy") return { payoutIntentId: input.payoutIntentId, status: "busy" };
  if (claim.kind === "terminal") return { payoutIntentId: input.payoutIntentId, status: claim.status as BgDevnetPayoutStatus };

  const context = await loadPayoutContext(db, input.payoutIntentId);
  if (!context) throw new Error("BG payout intent is missing its linked reward, program, asset or treasury.");
  const { payout, program, treasury } = context;

  try {
    const cluster = await gateway.getDevnetStatus();
    if (cluster.genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
      throw new PayoutQuarantineError("SOLANA_CLUSTER_MISMATCH");
    }
    if (!cluster.healthy) throw new PayoutDeferredError("SOLANA_DEVNET_RPC_UNHEALTHY");

    const validated = validatePayoutContext(context, signer, input.allowTestSigner === true);
    const hasExistingSignature = Boolean(payout.chainSignature);
    if (!hasExistingSignature) {
      if (payout.status !== "signing") {
        throw new PayoutQuarantineError("UNSIGNED_PAYOUT_STATE_INVALID");
      }
      if (program.status !== "active" || treasury.status !== "active") {
        await markCancelled(db, payout.id, "PROGRAM_OR_TREASURY_PAUSED_BEFORE_SIGNING", now);
        return { payoutIntentId: payout.id, status: "cancelled", reasonCode: "PROGRAM_OR_TREASURY_PAUSED_BEFORE_SIGNING" };
      }
      await verifyMintAndTokenAccounts(context, gateway, true);
      const latest = await gateway.getLatestBlockhash("confirmed");
      const built = await buildUnsignedTransaction(
        context,
        validated.sourceOwnerAddress,
        latest.blockhash,
        BigInt(latest.lastValidBlockHeight)
      );
      const simulation = await gateway.simulateTransaction(built.transactionBase64);
      if (simulation.err !== null) throw new PayoutDeferredError("TRANSFER_SIMULATION_FAILED");
      const signed = await signTransaction(signer, built.transactionBase64, validated.requiredSigners, validated.policy);
      await persistSignedTransaction(db, payout.id, {
        signature: signed.signature,
        recentBlockhash: latest.blockhash,
        lastValidBlockHeight: BigInt(latest.lastValidBlockHeight)
      }, now);
      try {
        const accepted = await gateway.sendTransaction(signed.signedTransactionBase64);
        if (accepted !== signed.signature) {
          throw new PayoutQuarantineError("BROADCAST_SIGNATURE_MISMATCH");
        }
        await markSubmitted(db, payout.id, signed.signature, now);
        return { payoutIntentId: payout.id, status: "submitted", signature: signed.signature };
      } catch (error) {
        if (error instanceof PayoutQuarantineError) throw error;
        try {
          const observed = await gateway.getSignatureStatuses([signed.signature]);
          if (observed.value[0]) {
            await markSubmitted(db, payout.id, signed.signature, now);
            return { payoutIntentId: payout.id, status: "submitted", signature: signed.signature };
          }
        } catch {
          // Keep the exact signed identity for a bounded same-signature retry.
        }
        await retryPayout(db, payout.id, "BROADCAST_OUTCOME_UNKNOWN", now, retryMs);
        return { payoutIntentId: payout.id, status: "signed", signature: signed.signature, reasonCode: "BROADCAST_OUTCOME_UNKNOWN" };
      }
    }

    return await processExistingSignature(db, context, gateway, signer, {
      now,
      leaseMs,
      retryMs,
      allowTestSigner: input.allowTestSigner === true
    });
  } catch (error) {
    if (error instanceof PayoutQuarantineError) {
      await markQuarantined(db, payout.id, error.code, now);
      return { payoutIntentId: payout.id, status: "quarantined", signature: payout.chainSignature, reasonCode: error.code };
    }
    if (error instanceof PayoutDeferredError) {
      await retryPayout(db, payout.id, error.code, now, retryMs);
      return { payoutIntentId: payout.id, status: payout.status as BgDevnetPayoutStatus, signature: payout.chainSignature, reasonCode: error.code };
    }
    await retryPayout(db, payout.id, "PAYOUT_RUNTIME_UNAVAILABLE", now, retryMs);
    return { payoutIntentId: payout.id, status: payout.status as BgDevnetPayoutStatus, signature: payout.chainSignature, reasonCode: "PAYOUT_RUNTIME_UNAVAILABLE" };
  }
}

/**
 * A bounded, sequential batch runner. Each payout is isolated so one signer or
 * RPC failure does not prevent unrelated reserved payouts from progressing.
 */
export async function processBgDevnetPayoutBatch(
  db: Database,
  gateway: SolanaGateway,
  signer: BgDevnetPayoutSigner,
  input: { limit?: number; now?: Date; allowTestSigner?: boolean } = {}
): Promise<{ selected: number; paid: number; deferred: number; quarantined: number; failed: number }> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? DEFAULT_BATCH_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || Number.isNaN(now.getTime())) {
    throw new RangeError("BG payout batch limit must be between 1 and 50 with a valid timestamp.");
  }
  const candidates = await db.select({ id: rewardPayoutIntents.id })
    .from(rewardPayoutIntents)
    .where(and(
      inArray(rewardPayoutIntents.status, ["queued", "signing", "signed", "submitted", "confirmed"]),
      or(isNull(rewardPayoutIntents.retryAfter), lte(rewardPayoutIntents.retryAfter, now))
    ))
    .orderBy(asc(rewardPayoutIntents.createdAt), asc(rewardPayoutIntents.id))
    .limit(limit);

  let paid = 0;
  let deferred = 0;
  let quarantined = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      const result = await processBgDevnetPayoutIntent(db, gateway, signer, {
        payoutIntentId: candidate.id,
        now,
        allowTestSigner: input.allowTestSigner
      });
      if (result.status === "paid") paid += 1;
      else if (result.status === "quarantined") quarantined += 1;
      else if (result.status === "failed") failed += 1;
      else if (!["not_found", "busy"].includes(result.status)) deferred += 1;
    } catch {
      deferred += 1;
    }
  }
  return { selected: candidates.length, paid, deferred, quarantined, failed };
}

/**
 * Records one finalized Devnet inventory snapshot and compares hot treasury
 * balance with outstanding PostgreSQL reward reservations and its configured cap.
 */
export async function reconcileBgDevnetTreasury(
  db: Database,
  gateway: SolanaGateway,
  input: { treasuryAccountId: string; now?: Date }
): Promise<{
  runId: string;
  status: "healthy" | "underfunded" | "over_cap" | "quarantined";
  observedBalanceBaseUnits: string | null;
  reservedLiabilityBaseUnits: string;
  hotWalletCapBaseUnits: string;
  finalizedSlot: string;
}> {
  const now = input.now ?? new Date();
  if (!input.treasuryAccountId || Number.isNaN(now.getTime())) {
    throw new TypeError("A treasury account ID and valid timestamp are required.");
  }
  const [treasury] = await db.select().from(treasuryAccounts)
    .where(eq(treasuryAccounts.id, input.treasuryAccountId))
    .limit(1);
  if (!treasury) throw new Error("BG treasury account was not found.");
  if (treasury.network !== "devnet" || !treasury.mintAddress || !treasury.treasuryWalletAddress || !treasury.tokenAccountAddress) {
    throw new PayoutQuarantineError("TREASURY_RECONCILIATION_CONFIGURATION_INVALID");
  }
  const [asset] = await db.select().from(assetRegistry)
    .where(eq(assetRegistry.id, treasury.assetId))
    .limit(1);
  if (
    !asset ||
    asset.assetCode !== "BG" ||
    asset.network !== "devnet" ||
    asset.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
    asset.mintAddress !== treasury.mintAddress ||
    asset.decimals === null ||
    asset.status !== "active" ||
    asset.metadataSource !== "verified"
  ) {
    throw new PayoutQuarantineError("TREASURY_RECONCILIATION_ASSET_INVALID");
  }
  const cluster = await gateway.getDevnetStatus();
  if (!cluster.healthy || cluster.genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
    throw new PayoutDeferredError("SOLANA_DEVNET_RPC_UNAVAILABLE");
  }

  const [mintInfo, tokenInfo] = await Promise.all([
    gateway.getAccountInfo(asset.mintAddress, "finalized"),
    gateway.getAccountInfo(treasury.tokenAccountAddress, "finalized")
  ]);
  const programs = await db.select({ reservedBaseUnits: rewardPrograms.reservedBaseUnits })
    .from(rewardPrograms)
    .where(eq(rewardPrograms.assetId, asset.id));
  const reservedLiability = programs.reduce((sum, row) => sum + row.reservedBaseUnits, 0n);
  let observedBalance: bigint | null = null;
  let status: "healthy" | "underfunded" | "over_cap" | "quarantined" = "healthy";
  const details: Record<string, unknown> = {
    mintAddress: asset.mintAddress,
    tokenAccountAddress: treasury.tokenAccountAddress,
    reservedLiabilityBaseUnits: reservedLiability.toString(),
    hotWalletCapBaseUnits: treasury.hotWalletCapBaseUnits.toString()
  };

  try {
    if (!mintInfo.account || !tokenInfo.account) throw new Error("account_missing");
    const mint = parseClassicSplMint({
      owner: mintInfo.account.owner,
      dataBase64: mintInfo.account.data[0]
    });
    const token = parseClassicSplTokenAccount({
      owner: tokenInfo.account.owner,
      dataBase64: tokenInfo.account.data[0]
    });
    const expectedAta = await deriveClassicSplAssociatedTokenAddress({
      ownerAddress: treasury.treasuryWalletAddress,
      mintAddress: asset.mintAddress
    });
    if (
      expectedAta !== treasury.tokenAccountAddress ||
      mint.decimals !== asset.decimals ||
      token.owner !== treasury.treasuryWalletAddress ||
      token.mint !== asset.mintAddress ||
      token.state !== "initialized" ||
      treasury.hotWalletCapBaseUnits <= 0n
    ) {
      throw new Error("account_identity_mismatch");
    }
    observedBalance = token.amountBaseUnits;
    if (observedBalance < reservedLiability) status = "underfunded";
    else if (observedBalance > treasury.hotWalletCapBaseUnits) status = "over_cap";
  } catch (error) {
    status = "quarantined";
    details.reasonCode = error instanceof Error && error.message === "account_missing"
      ? "TREASURY_ACCOUNT_MISSING"
      : "TREASURY_ACCOUNT_MISMATCH";
  }

  const runId = createUuidV7(now.getTime());
  await db.transaction(async (tx) => {
    await tx.insert(bgTreasuryReconciliationRuns).values({
      id: runId,
      treasuryAccountId: treasury.id,
      assetId: asset.id,
      network: "devnet",
      tokenAccountAddress: treasury.tokenAccountAddress!,
      mintAddress: asset.mintAddress!,
      observedBalanceBaseUnits: observedBalance,
      reservedLiabilityBaseUnits: reservedLiability,
      hotWalletCapBaseUnits: treasury.hotWalletCapBaseUnits,
      finalizedSlot: BigInt(cluster.slot),
      status,
      details,
      createdAt: now
    });
    await tx.update(treasuryAccounts).set({ lastReconciledAt: now, updatedAt: now })
      .where(eq(treasuryAccounts.id, treasury.id));
    await tx.insert(rewardAuditEvents).values({
      id: createUuidV7(now.getTime()),
      actorType: "service",
      actorId: null,
      action: "bg.treasury.reconciliation.completed",
      targetType: "treasury_account",
      targetId: treasury.id,
      reason: "A finalized Devnet hot treasury inventory snapshot was recorded.",
      metadata: {
        runId,
        status,
        observedBalanceBaseUnits: observedBalance?.toString() ?? null,
        reservedLiabilityBaseUnits: reservedLiability.toString(),
        hotWalletCapBaseUnits: treasury.hotWalletCapBaseUnits.toString(),
        finalizedSlot: cluster.slot.toString(),
        ...details
      },
      createdAt: now
    });
  });

  return {
    runId,
    status,
    observedBalanceBaseUnits: observedBalance?.toString() ?? null,
    reservedLiabilityBaseUnits: reservedLiability.toString(),
    hotWalletCapBaseUnits: treasury.hotWalletCapBaseUnits.toString(),
    finalizedSlot: cluster.slot.toString()
  };
}
