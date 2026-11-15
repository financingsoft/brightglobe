import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import {
  assetAccounts,
  assetIdempotencyKeys,
  assetLedgerPostings,
  assetTransactionIntents,
  assetLedgerTransactions,
  walletOwnerships
} from "../../db/schema.js";
import { createUuidV7 } from "../../identity/ids.js";
import { assertBalancedPostings, type LedgerPostingInput } from "./invariants.js";
import { assertFinalizedChainEvidence } from "./evidence.js";
import { getOrCreateUserAssetAccount } from "../asset-service.js";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class LedgerIdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used with a different ledger request.");
    this.name = "LedgerIdempotencyConflictError";
  }
}

export class LedgerAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerAccountError";
  }
}

export interface PostLedgerTransactionInput {
  canonicalUserId: string;
  assetId: string;
  operation: string;
  idempotencyKey: string;
  transactionType: string;
  referenceType: string;
  referenceId: string;
  postings: readonly LedgerPostingInput[];
  counterpartyUserIds?: readonly string[];
}

export async function postLedgerTransaction(
  db: Database,
  input: PostLedgerTransactionInput
): Promise<{ transactionId: string; replayed: boolean }> {
  if (!input.idempotencyKey || input.idempotencyKey.length > 128) {
    throw new TypeError("Idempotency key must contain 1 to 128 characters.");
  }
  if (!input.operation || input.operation.length > 40) throw new TypeError("Ledger operation is invalid.");
  assertBalancedPostings(input.postings);
  if (input.referenceType === "asset_transaction_intent") {
    const [intent] = await db.select().from(assetTransactionIntents)
      .where(eq(assetTransactionIntents.id, input.referenceId))
      .limit(1);
    if (!intent || intent.assetId !== input.assetId || intent.canonicalUserId !== input.canonicalUserId) {
      throw new LedgerAccountError("The finalized asset transaction does not match this ledger posting.");
    }
    assertFinalizedChainEvidence(intent);
  }

  const sortedPostings = [...input.postings].sort((a, b) => a.accountId.localeCompare(b.accountId));
  const payloadHash = await sha256(JSON.stringify({
    assetId: input.assetId,
    transactionType: input.transactionType,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    postings: sortedPostings.map((posting) => ({
      accountId: posting.accountId,
      deltaBaseUnits: posting.deltaBaseUnits.toString()
    }))
  }));

  const existing = await db.select().from(assetIdempotencyKeys)
    .where(and(
      eq(assetIdempotencyKeys.canonicalUserId, input.canonicalUserId),
      eq(assetIdempotencyKeys.operation, input.operation),
      eq(assetIdempotencyKeys.idempotencyKey, input.idempotencyKey)
    ))
    .limit(1);

  if (existing[0]) {
    if (existing[0].payloadHash !== payloadHash || !existing[0].ledgerTransactionId) {
      throw new LedgerIdempotencyConflictError();
    }
    return { transactionId: existing[0].ledgerTransactionId, replayed: true };
  }

  const now = new Date();
  const allowedOwners = new Set([input.canonicalUserId, ...(input.counterpartyUserIds ?? [])]);

  try {
    const transactionId = await db.transaction(async (transaction) => {
      const accountIds = sortedPostings.map((posting) => posting.accountId);
      const accounts = await transaction.select().from(assetAccounts)
        .where(inArray(assetAccounts.id, accountIds))
        .orderBy(asc(assetAccounts.id))
        .for("update");

      if (accounts.length !== accountIds.length) {
        throw new LedgerAccountError("One or more asset ledger accounts do not exist.");
      }

      const accountById = new Map(accounts.map((account) => [account.id, account] as const));
      for (const posting of sortedPostings) {
        const account = accountById.get(posting.accountId);
        if (!account || account.assetId !== input.assetId) {
          throw new LedgerAccountError("Every posting must reference an account for the same asset.");
        }
        if (account.accountType === "user" && (!account.canonicalUserId || !allowedOwners.has(account.canonicalUserId))) {
          throw new LedgerAccountError("The ledger request is not authorized to post to this user account.");
        }
        if (account.accountType === "user" && account.balanceBaseUnits + posting.deltaBaseUnits < 0n) {
          throw new LedgerAccountError("The user asset account has insufficient available balance.");
        }
      }

      const id = createUuidV7(now.getTime());
      await transaction.insert(assetLedgerTransactions).values({
        id,
        assetId: input.assetId,
        transactionType: input.transactionType,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        createdAt: now
      });

      await transaction.insert(assetLedgerPostings).values(sortedPostings.map((posting) => ({
        id: createUuidV7(now.getTime()),
        transactionId: id,
        accountId: posting.accountId,
        deltaBaseUnits: posting.deltaBaseUnits,
        createdAt: now
      })));

      await transaction.insert(assetIdempotencyKeys).values({
        id: createUuidV7(now.getTime()),
        canonicalUserId: input.canonicalUserId,
        operation: input.operation,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        ledgerTransactionId: id,
        createdAt: now
      });

      return id;
    });

    return { transactionId, replayed: false };
  } catch (error) {
    // Recover a concurrent request that committed the same idempotency key.
    const raced = await db.select().from(assetIdempotencyKeys)
      .where(and(
        eq(assetIdempotencyKeys.canonicalUserId, input.canonicalUserId),
        eq(assetIdempotencyKeys.operation, input.operation),
        eq(assetIdempotencyKeys.idempotencyKey, input.idempotencyKey)
      ))
      .limit(1);
    if (raced[0]) {
      if (raced[0].payloadHash !== payloadHash || !raced[0].ledgerTransactionId) {
        throw new LedgerIdempotencyConflictError();
      }
      return { transactionId: raced[0].ledgerTransactionId, replayed: true };
    }
    throw error;
  }
}


export async function postFinalizedAssetTransaction(
  db: Database,
  input: {
    intentId: string;
    postings: readonly LedgerPostingInput[];
    counterpartyUserIds?: readonly string[];
  }
): Promise<{ transactionId: string; replayed: boolean }> {
  const [intent] = await db.select().from(assetTransactionIntents)
    .where(eq(assetTransactionIntents.id, input.intentId))
    .limit(1);
  if (!intent) throw new LedgerAccountError("The asset transaction intent was not found.");
  assertFinalizedChainEvidence(intent);

  return postLedgerTransaction(db, {
    canonicalUserId: intent.canonicalUserId,
    assetId: intent.assetId,
    operation: "settle_chain_transaction",
    idempotencyKey: intent.id,
    transactionType: intent.operation,
    referenceType: "asset_transaction_intent",
    referenceId: intent.id,
    postings: input.postings,
    counterpartyUserIds: input.counterpartyUserIds
  });
}

async function getOrCreateSystemAssetAccount(db: Database, assetId: string) {
  const [existing] = await db.select().from(assetAccounts)
    .where(and(
      eq(assetAccounts.assetId, assetId),
      eq(assetAccounts.accountType, "system")
    ))
    .limit(1);
  if (existing) return existing;

  const now = new Date();
  await db.insert(assetAccounts).values({
    id: createUuidV7(now.getTime()),
    assetId,
    canonicalUserId: null,
    accountType: "system",
    balanceBaseUnits: 0n,
    createdAt: now,
    updatedAt: now
  }).onConflictDoNothing();

  const [account] = await db.select().from(assetAccounts)
    .where(and(
      eq(assetAccounts.assetId, assetId),
      eq(assetAccounts.accountType, "system")
    ))
    .limit(1);
  if (!account) throw new LedgerAccountError("Unable to initialize the system clearing account.");
  return account;
}

export async function settleFinalizedAssetTransaction(
  db: Database,
  intentId: string
): Promise<{ posted: boolean; transactionId: string | null; reason: string }> {
  const [intent] = await db.select().from(assetTransactionIntents)
    .where(eq(assetTransactionIntents.id, intentId))
    .limit(1);
  if (!intent) throw new LedgerAccountError("The asset transaction intent was not found.");
  assertFinalizedChainEvidence(intent);
  if (intent.ledgerPostedAt) {
    return { posted: true, transactionId: null, reason: "already_settled" };
  }
  if (intent.operation !== "transfer" || !intent.fromAddress || !intent.toAddress) {
    throw new LedgerAccountError("Only verified wallet transfers can be settled by this ledger adapter.");
  }

  const [sourceWallet] = await db.select().from(walletOwnerships)
    .where(and(
      eq(walletOwnerships.network, "devnet"),
      eq(walletOwnerships.address, intent.fromAddress),
      eq(walletOwnerships.canonicalUserId, intent.canonicalUserId)
    ))
    .limit(1);
  if (!sourceWallet) {
    throw new LedgerAccountError("The finalized transfer source wallet is not linked to the transaction owner.");
  }

  const [destinationWallet] = await db.select().from(walletOwnerships)
    .where(and(
      eq(walletOwnerships.network, "devnet"),
      eq(walletOwnerships.address, intent.toAddress)
    ))
    .limit(1);

  if (destinationWallet?.canonicalUserId === intent.canonicalUserId) {
    const now = new Date();
    await db.update(assetTransactionIntents)
      .set({ ledgerPostedAt: now, updatedAt: now })
      .where(and(
        eq(assetTransactionIntents.id, intent.id),
        eq(assetTransactionIntents.status, "finalized"),
        isNull(assetTransactionIntents.ledgerPostedAt)
      ));
    return { posted: false, transactionId: null, reason: "same_canonical_owner_no_net_balance_change" };
  }

  const sourceAccount = await getOrCreateUserAssetAccount(db, {
    canonicalUserId: intent.canonicalUserId,
    assetId: intent.assetId
  });
  const destinationAccount = destinationWallet
    ? await getOrCreateUserAssetAccount(db, {
        canonicalUserId: destinationWallet.canonicalUserId,
        assetId: intent.assetId
      })
    : await getOrCreateSystemAssetAccount(db, intent.assetId);

  const settlement = await postFinalizedAssetTransaction(db, {
    intentId: intent.id,
    postings: [
      { accountId: sourceAccount.id, deltaBaseUnits: -intent.amountBaseUnits },
      { accountId: destinationAccount.id, deltaBaseUnits: intent.amountBaseUnits }
    ],
    counterpartyUserIds: destinationWallet ? [destinationWallet.canonicalUserId] : []
  });

  const now = new Date();
  await db.update(assetTransactionIntents)
    .set({ ledgerPostedAt: now, updatedAt: now })
    .where(and(
      eq(assetTransactionIntents.id, intent.id),
      eq(assetTransactionIntents.status, "finalized"),
      isNull(assetTransactionIntents.ledgerPostedAt)
    ));

  return {
    posted: !settlement.replayed,
    transactionId: settlement.transactionId,
    reason: settlement.replayed ? "already_settled" : "finalized_transfer_posted"
  };
}
