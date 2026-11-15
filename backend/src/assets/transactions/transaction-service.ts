import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import {
  assetAccounts,
  assetRegistry,
  assetTransactionIntents,
  assetTransactionTransitions,
  walletOwnerships
} from "../../db/schema.js";
import { createUuidV7 } from "../../identity/ids.js";
import { getOrCreateUserAssetAccount } from "../asset-service.js";
import { isValidSolanaAddress } from "../../blockchain/solana/address.js";
import { assertAssetTransactionTransition, type AssetTransactionStatus } from "./state-machine.js";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class AssetTransactionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetTransactionConflictError";
  }
}

export interface CreateAssetTransactionInput {
  canonicalUserId: string;
  assetId: string;
  operation: "transfer" | "deposit" | "withdrawal" | "reward";
  amountBaseUnits: bigint;
  fromAddress?: string | null;
  toAddress?: string | null;
  idempotencyKey: string;
  recentBlockhash?: string | null;
  lastValidBlockHeight?: bigint | null;
  expiresAt?: Date | null;
}

export async function createAssetTransactionIntent(
  db: Database,
  input: CreateAssetTransactionInput
): Promise<{ intentId: string; replayed: boolean; recentBlockhash: string | null; lastValidBlockHeight: string | null }> {
  if (input.amountBaseUnits <= 0n) throw new RangeError("Asset transaction amount must be positive.");
  if (input.operation === "transfer") {
    if (input.amountBaseUnits > 18446744073709551615n) {
      throw new RangeError("Classic SPL Token transfer amounts must fit in an unsigned 64-bit integer.");
    }
    if (!input.recentBlockhash || !isValidSolanaAddress(input.recentBlockhash) || input.lastValidBlockHeight === null || input.lastValidBlockHeight === undefined || input.lastValidBlockHeight < 0n) {
      throw new TypeError("A valid recent blockhash and last valid block height are required for transfers.");
    }
    if (!input.fromAddress || !input.toAddress ||
        !isValidSolanaAddress(input.fromAddress) || !isValidSolanaAddress(input.toAddress) ||
        input.fromAddress === input.toAddress) {
      throw new TypeError("A transfer requires distinct valid Solana source and destination wallets.");
    }
    const [sourceWallet] = await db.select({ id: walletOwnerships.id })
      .from(walletOwnerships)
      .where(and(
        eq(walletOwnerships.canonicalUserId, input.canonicalUserId),
        eq(walletOwnerships.network, "devnet"),
        eq(walletOwnerships.address, input.fromAddress)
      ))
      .limit(1);
    if (!sourceWallet) {
      throw new AssetTransactionConflictError("The source wallet is not linked to this BrightGlobe account.");
    }
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 128) {
    throw new TypeError("Idempotency key must contain 1 to 128 characters.");
  }

  const [asset] = await db.select().from(assetRegistry)
    .where(eq(assetRegistry.id, input.assetId))
    .limit(1);
  if (!asset || asset.status !== "active" || !asset.mintAddress || asset.decimals === null) {
    throw new AssetTransactionConflictError("The asset is not configured for transactions.");
  }
  if (asset.network !== "devnet") {
    throw new AssetTransactionConflictError("Only Devnet asset transactions are enabled in this release.");
  }

  const requestHash = await sha256(JSON.stringify({
    assetId: input.assetId,
    operation: input.operation,
    amountBaseUnits: input.amountBaseUnits.toString(),
    fromAddress: input.fromAddress ?? null,
    toAddress: input.toAddress ?? null
  }));

  const existing = await db.select().from(assetTransactionIntents)
    .where(and(
      eq(assetTransactionIntents.canonicalUserId, input.canonicalUserId),
      eq(assetTransactionIntents.idempotencyKey, input.idempotencyKey)
    ))
    .limit(1);
  if (existing[0]) {
    if (existing[0].requestHash !== requestHash) {
      throw new AssetTransactionConflictError("The idempotency key was reused with a different request.");
    }
    return { intentId: existing[0].id, replayed: true, recentBlockhash: existing[0].recentBlockhash, lastValidBlockHeight: existing[0].lastValidBlockHeight?.toString() ?? null };
  }

  const now = new Date();
  const intentId = createUuidV7(now.getTime());
  const expiresAt = input.expiresAt === undefined ? new Date(now.getTime() + 2 * 60 * 1000) : input.expiresAt;
  if (input.operation === "transfer") {
    await getOrCreateUserAssetAccount(db, {
      canonicalUserId: input.canonicalUserId,
      assetId: input.assetId
    });
  }
  try {
    await db.transaction(async (transaction) => {
      if (input.operation === "transfer") {
        // Lock the user's aggregate asset account so parallel transfer-intent
        // creation cannot reserve the same internal BG balance twice.
        const [userAccount] = await transaction.select().from(assetAccounts)
          .where(and(
            eq(assetAccounts.assetId, input.assetId),
            eq(assetAccounts.canonicalUserId, input.canonicalUserId),
            eq(assetAccounts.accountType, "user")
          ))
          .limit(1)
          .for("update");
        if (!userAccount) {
          throw new AssetTransactionConflictError("The BrightGlobe asset account is unavailable.");
        }

        const [reservation] = await transaction.select({
          reservedBaseUnits: sql<string>`COALESCE(SUM(${assetTransactionIntents.amountBaseUnits}), 0)::text`
        }).from(assetTransactionIntents)
          .where(and(
            eq(assetTransactionIntents.canonicalUserId, input.canonicalUserId),
            eq(assetTransactionIntents.assetId, input.assetId),
            eq(assetTransactionIntents.operation, "transfer"),
            isNull(assetTransactionIntents.ledgerPostedAt),
            or(
              inArray(assetTransactionIntents.status, ["submitted", "confirmed", "finalized"]),
              and(
                inArray(assetTransactionIntents.status, ["created", "signed"]),
                gt(assetTransactionIntents.expiresAt, now)
              )
            )
          ));
        const reservedBaseUnits = BigInt(reservation?.reservedBaseUnits ?? "0");
        if (userAccount.balanceBaseUnits - reservedBaseUnits < input.amountBaseUnits) {
          throw new AssetTransactionConflictError(
            "The available BG ledger balance is already reserved by other pending transfers."
          );
        }
      }

      await transaction.insert(assetTransactionIntents).values({
        id: intentId,
        canonicalUserId: input.canonicalUserId,
        assetId: input.assetId,
        operation: input.operation,
        amountBaseUnits: input.amountBaseUnits,
        fromAddress: input.fromAddress ?? null,
        toAddress: input.toAddress ?? null,
        recentBlockhash: input.recentBlockhash ?? null,
        lastValidBlockHeight: input.lastValidBlockHeight ?? null,
        status: "created",
        requestHash,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
        createdAt: now,
        updatedAt: now
      });
      await transaction.insert(assetTransactionTransitions).values({
        id: createUuidV7(now.getTime()),
        intentId,
        fromStatus: null,
        toStatus: "created",
        reason: "intent_created",
        metadata: {},
        createdAt: now
      });
    });
    return { intentId, replayed: false, recentBlockhash: input.recentBlockhash ?? null, lastValidBlockHeight: input.lastValidBlockHeight?.toString() ?? null };
  } catch (error) {
    const raced = await db.select().from(assetTransactionIntents)
      .where(and(
        eq(assetTransactionIntents.canonicalUserId, input.canonicalUserId),
        eq(assetTransactionIntents.idempotencyKey, input.idempotencyKey)
      ))
      .limit(1);
    if (raced[0]) {
      if (raced[0].requestHash !== requestHash) {
        throw new AssetTransactionConflictError("The idempotency key was reused with a different request.");
      }
      return { intentId: raced[0].id, replayed: true, recentBlockhash: raced[0].recentBlockhash, lastValidBlockHeight: raced[0].lastValidBlockHeight?.toString() ?? null };
    }
    throw error;
  }
}

export async function transitionAssetTransaction(
  db: Database,
  input: {
    intentId: string;
    toStatus: AssetTransactionStatus;
    reason: string;
    metadata?: Record<string, unknown>;
    chainSignature?: string | null;
    chainSlot?: bigint | null;
    chainCommitment?: "processed" | "confirmed" | "finalized" | null;
  }
): Promise<void> {
  if (!input.reason || input.reason.length > 256) throw new TypeError("A transition reason is required.");

  const now = new Date();
  await db.transaction(async (transaction) => {
    const [intent] = await transaction.select().from(assetTransactionIntents)
      .where(eq(assetTransactionIntents.id, input.intentId))
      .limit(1)
      .for("update");
    if (!intent) throw new AssetTransactionConflictError("The transaction intent was not found.");

    const fromStatus = intent.status as AssetTransactionStatus;
    if (intent.expiresAt && intent.expiresAt <= now && (fromStatus === "created" || fromStatus === "signed") && input.toStatus !== "expired") {
      throw new AssetTransactionConflictError("The transaction intent has expired.");
    }
    if (input.toStatus === "expired") {
      const unsignedExpired =
        (fromStatus === "created" || fromStatus === "signed") &&
        intent.expiresAt !== null &&
        intent.expiresAt <= now;
      const blockhashExpired =
        (fromStatus === "created" || fromStatus === "signed" || fromStatus === "submitted") &&
        input.reason === "blockhash_expired" &&
        intent.lastValidBlockHeight !== null;
      if (!unsignedExpired && !blockhashExpired) {
        throw new AssetTransactionConflictError("The transaction intent has not met its expiry conditions.");
      }
    }
    assertAssetTransactionTransition(fromStatus, input.toStatus);

    const signature = input.chainSignature ?? intent.chainSignature;
    const slot = input.chainSlot ?? intent.chainSlot;
    const commitment = input.chainCommitment ?? intent.chainCommitment;

    if (input.toStatus === "submitted" && !signature) {
      throw new AssetTransactionConflictError("A submitted transaction requires its chain signature.");
    }
    if (input.toStatus === "confirmed" && (!signature || slot === null || commitment !== "confirmed")) {
      throw new AssetTransactionConflictError("A confirmed transaction requires signature, slot, and confirmed commitment.");
    }
    if (input.toStatus === "finalized" && (!signature || slot === null || commitment !== "finalized")) {
      throw new AssetTransactionConflictError("A finalized transaction requires signature, slot, and finalized commitment.");
    }
    if (intent.chainSignature && input.chainSignature && intent.chainSignature !== input.chainSignature) {
      throw new AssetTransactionConflictError("The transaction signature cannot be replaced.");
    }
    if (input.chainSlot !== undefined && input.chainSlot !== null && input.chainSlot < 0n) {
      throw new RangeError("Chain slot cannot be negative.");
    }

    await transaction.update(assetTransactionIntents)
      .set({
        status: input.toStatus,
        chainSignature: signature,
        chainSlot: slot,
        chainCommitment: commitment,
        updatedAt: now
      })
      .where(eq(assetTransactionIntents.id, input.intentId));

    await transaction.insert(assetTransactionTransitions).values({
      id: createUuidV7(now.getTime()),
      intentId: input.intentId,
      fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
      metadata: input.metadata ?? {},
      createdAt: now
    });
  });
}


export async function expireStaleAssetTransactionIntents(
  db: Database,
  limit = 100
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError("Transaction expiry batch must be between 1 and 500.");
  }
  const now = new Date();
  const expired = await db.select({ id: assetTransactionIntents.id })
    .from(assetTransactionIntents)
    .where(and(
      inArray(assetTransactionIntents.status, ["created", "signed"]),
      lte(assetTransactionIntents.expiresAt, now)
    ))
    .limit(limit);

  for (const intent of expired) {
    await transitionAssetTransaction(db, {
      intentId: intent.id,
      toStatus: "expired",
      reason: "unsigned_transaction_intent_expired"
    });
  }
  return expired.length;
}
