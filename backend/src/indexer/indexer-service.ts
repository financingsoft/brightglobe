import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  assetTransactionIntents,
  chainIndexerCursors,
  chainIndexerSources,
  chainObservedEvents,
  chainReconciliationDiscrepancies,
  walletOwnerships
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import { classifyChainEvent } from "./event-policy.js";
import type { SolanaGateway } from "../blockchain/solana/gateway.js";
import { decodeFinalizedClassicTokenEvents } from "../blockchain/solana/transaction-decoder.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID, parseClassicSplMint, parseClassicSplTokenAccount } from "../blockchain/solana/token/classic-token.js";
import { recordTokenAccountOpeningBalance } from "./opening-balance.js";
import { processObservedBgAssetEvents } from "./event-settlement.js";
import { expireStaleAssetTransactionIntents, transitionAssetTransaction } from "../assets/transactions/transaction-service.js";
import { settleFinalizedAssetTransaction } from "../assets/ledger/ledger-service.js";
import { hasBlockhashExpired } from "../assets/transactions/blockhash.js";
import { findMatchingFinalizedTransferEvent, matchesFinalizedTransactionEnvelope, matchesFinalizedTransactionIdentity } from "./transaction-verifier.js";


async function verifyFinalizedTransferIntent(
  db: Database,
  gateway: SolanaGateway,
  intent: typeof assetTransactionIntents.$inferSelect,
  expectedSlot: bigint
): Promise<{ valid: boolean; retryable?: boolean; observed: Record<string, unknown> }> {
  const signature = intent.chainSignature;
  const recentBlockhash = intent.recentBlockhash;
  const fromAddress = intent.fromAddress;
  const toAddress = intent.toAddress;
  if (intent.operation !== "transfer" || !signature || !recentBlockhash || !fromAddress || !toAddress) {
    return { valid: false, observed: { reason: "unsupported_or_incomplete_intent" } };
  }

  const [asset] = await db.select().from(assetRegistry)
    .where(eq(assetRegistry.id, intent.assetId))
    .limit(1);
  if (!asset || !asset.mintAddress || asset.decimals === null) {
    return { valid: false, retryable: true, observed: { reason: "asset_mint_not_configured" } };
  }
  const mintAddress = asset.mintAddress;

  const transaction = await gateway.getTransaction(signature);
  if (transaction === null) {
    return { valid: false, retryable: true, observed: { reason: "finalized_transaction_data_unavailable" } };
  }
  if (!matchesFinalizedTransactionEnvelope(transaction, signature, recentBlockhash, expectedSlot)) {
    return { valid: false, observed: { reason: "finalized_transaction_envelope_mismatch" } };
  }
  const events = decodeFinalizedClassicTokenEvents(signature, transaction);
  const [sourceAccounts, destinationAccounts] = await Promise.all([
    gateway.getTokenAccountsByOwner(fromAddress, mintAddress),
    gateway.getTokenAccountsByOwner(toAddress, mintAddress)
  ]);
  const sourceSet = new Set(sourceAccounts.map((account) => account.address));
  const destinationSet = new Set(destinationAccounts.map((account) => account.address));

  const matching = findMatchingFinalizedTransferEvent(events, {
    fromAddress,
    toAddress,
    amountBaseUnits: intent.amountBaseUnits,
    mintAddress,
    slot: expectedSlot
  }, sourceSet, destinationSet);

  if (matching) {
    return {
      valid: true,
      observed: {
        signature,
        slot: expectedSlot.toString(),
        mintAddress,
        source: matching.payload.source,
        destination: matching.payload.destination,
        amountBaseUnits: matching.payload.amountBaseUnits
      }
    };
  }

  return {
    valid: false,
    observed: {
      signature,
      slot: expectedSlot.toString(),
      mintAddress,
      decodedEvents: events.map((event) => ({
        eventType: event.eventType,
        slot: event.slot.toString(),
        payload: event.payload
      }))
    }
  };
}

export async function syncPendingTransactionIntents(
  db: Database,
  gateway: SolanaGateway,
  limit = 50
): Promise<{ checked: number; confirmed: number; finalized: number; failed: number; expired: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("Transaction status sync limit must be between 1 and 100.");
  }
  const expired = await expireStaleAssetTransactionIntents(db);
  const pending = await db.select().from(assetTransactionIntents)
    .where(or(
      inArray(assetTransactionIntents.status, ["submitted", "confirmed"]),
      and(eq(assetTransactionIntents.status, "finalized"), isNull(assetTransactionIntents.ledgerPostedAt))
    ))
    .orderBy(sql`last_status_check_at ASC NULLS FIRST`, asc(assetTransactionIntents.createdAt))
    .limit(limit);

  let confirmed = 0;
  let finalized = 0;
  let failed = 0;
  let expiredCount = expired;
  const needsBlockHeight = pending.some((intent) =>
    intent.status === "submitted" && intent.lastValidBlockHeight !== null
  );
  const currentBlockHeight = needsBlockHeight
    ? BigInt(await gateway.getBlockHeight("confirmed"))
    : null;
  for (const intent of pending) {
    try {
      if (intent.status === "finalized") {
        await settleFinalizedAssetTransaction(db, intent.id);
        continue;
      }
      if (!intent.chainSignature) continue;
      const response = await gateway.getSignatureStatuses([intent.chainSignature]);
      const status = response.value[0];
      if (!status) {
        if (
          intent.status === "submitted" &&
          intent.lastValidBlockHeight !== null &&
          currentBlockHeight !== null &&
          hasBlockhashExpired(currentBlockHeight, intent.lastValidBlockHeight)
        ) {
          await transitionAssetTransaction(db, {
            intentId: intent.id,
            toStatus: "expired",
            reason: "blockhash_expired"
          });
          expiredCount += 1;
        }
        continue;
      }
      if (!status.confirmationStatus) continue;
      if (!Number.isSafeInteger(status.slot) || status.slot < 0) {
        throw new Error("Solana RPC returned an unsafe transaction slot.");
      }
      const chainSlot = BigInt(status.slot);

      if (status.confirmationStatus === "finalized") {
        if (status.err !== null) {
          await transitionAssetTransaction(db, {
            intentId: intent.id,
            toStatus: "failed",
            reason: "chain_transaction_finalized_with_error",
            metadata: { error: status.err },
            chainSignature: intent.chainSignature,
            chainSlot,
            chainCommitment: "finalized"
          });
          failed += 1;
          continue;
        }

        if (intent.status === "submitted") {
          await transitionAssetTransaction(db, {
            intentId: intent.id,
            toStatus: "confirmed",
            reason: "chain_transaction_confirmed",
            chainSignature: intent.chainSignature,
            chainSlot,
            chainCommitment: "confirmed"
          });
          confirmed += 1;
        }
        const verification = await verifyFinalizedTransferIntent(db, gateway, intent, chainSlot);
        if (verification.retryable) continue;
        if (!verification.valid) {
          await recordReconciliationDiscrepancy(db, {
            network: "devnet",
            assetId: intent.assetId,
            transactionIntentId: intent.id,
            discrepancyType: "transaction_intent_chain_mismatch",
            expected: {
              fromAddress: intent.fromAddress,
              toAddress: intent.toAddress,
              amountBaseUnits: intent.amountBaseUnits.toString()
            },
            observed: verification.observed
          });
          await transitionAssetTransaction(db, {
            intentId: intent.id,
            toStatus: "failed",
            reason: "finalized_chain_transaction_did_not_match_intent",
            metadata: verification.observed,
            chainSignature: intent.chainSignature,
            chainSlot,
            chainCommitment: "finalized"
          });
          failed += 1;
          continue;
        }

        await transitionAssetTransaction(db, {
          intentId: intent.id,
          toStatus: "finalized",
          reason: "chain_transaction_finalized_and_matched",
          metadata: verification.observed,
          chainSignature: intent.chainSignature,
          chainSlot,
          chainCommitment: "finalized"
        });
        finalized += 1;
        await settleFinalizedAssetTransaction(db, intent.id);
        continue;
      }

      if (status.confirmationStatus === "confirmed" && status.err === null && intent.status === "submitted") {
        await transitionAssetTransaction(db, {
          intentId: intent.id,
          toStatus: "confirmed",
          reason: "chain_transaction_confirmed",
          chainSignature: intent.chainSignature,
          chainSlot,
          chainCommitment: "confirmed"
        });
        confirmed += 1;
      }
    } finally {
      await db.update(assetTransactionIntents)
        .set({ lastStatusCheckAt: new Date() })
        .where(eq(assetTransactionIntents.id, intent.id));
    }
  }

  return { checked: pending.length, confirmed, finalized, failed, expired: expiredCount };
}

export class IndexerGapError extends Error {
  constructor(readonly expectedNextSlot: bigint, readonly receivedFromSlot: bigint) {
    super(`Indexer slot gap: expected ${expectedNextSlot}, received ${receivedFromSlot}.`);
    this.name = "IndexerGapError";
  }
}

export interface FinalizedChainEvent {
  signature: string;
  slot: bigint;
  instructionIndex: number;
  eventIndex: number;
  programId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export async function ingestFinalizedBatch(
  db: Database,
  input: {
    network: "devnet";
    sourceKey: string;
    fromSlot: bigint;
    toSlot: bigint;
    events: readonly FinalizedChainEvent[];
  }
): Promise<{ insertedEvents: number; lastFinalizedSlot: string; replayed: boolean }> {
  if (!input.sourceKey || input.sourceKey.length > 64) throw new TypeError("Indexer source key must contain 1 to 64 characters.");
  if (input.fromSlot < 0n || input.toSlot < input.fromSlot) {
    throw new RangeError("Indexer slot range is invalid.");
  }
  for (const event of input.events) {
    if (
      event.slot < input.fromSlot ||
      event.slot > input.toSlot ||
      !event.signature ||
      event.signature.length > 128 ||
      !Number.isInteger(event.instructionIndex) ||
      event.instructionIndex < 0 ||
      !Number.isInteger(event.eventIndex) ||
      event.eventIndex < 0
    ) {
      throw new TypeError("A finalized chain event is malformed or outside the requested slot range.");
    }
  }

  return db.transaction(async (transaction) => {
    let [cursor] = await transaction.select().from(chainIndexerCursors)
      .where(and(eq(chainIndexerCursors.network, input.network), eq(chainIndexerCursors.sourceKey, input.sourceKey)))
      .limit(1)
      .for("update");

    if (!cursor) {
      await transaction.insert(chainIndexerCursors).values({
        id: createUuidV7(),
        network: input.network,
        sourceKey: input.sourceKey,
        lastFinalizedSlot: input.fromSlot - 1n,
        updatedAt: new Date()
      }).onConflictDoNothing();
      [cursor] = await transaction.select().from(chainIndexerCursors)
        .where(and(eq(chainIndexerCursors.network, input.network), eq(chainIndexerCursors.sourceKey, input.sourceKey)))
        .limit(1)
        .for("update");
    }
    if (!cursor) throw new Error("Unable to initialize the chain indexer cursor.");

    if (input.toSlot <= cursor.lastFinalizedSlot) {
      return {
        insertedEvents: 0,
        lastFinalizedSlot: cursor.lastFinalizedSlot.toString(),
        replayed: true
      };
    }

    const expectedNextSlot = cursor.lastFinalizedSlot + 1n;
    if (input.fromSlot > expectedNextSlot) {
      throw new IndexerGapError(expectedNextSlot, input.fromSlot);
    }

    let insertedEvents = 0;
    const now = new Date();
    for (const event of input.events) {
      if (event.slot < expectedNextSlot) continue;
      const processingStatus = classifyChainEvent(event);
      const inserted = await transaction.insert(chainObservedEvents).values({
        id: createUuidV7(now.getTime()),
        network: input.network,
        signature: event.signature,
        slot: event.slot,
        instructionIndex: event.instructionIndex,
        eventIndex: event.eventIndex,
        programId: event.programId,
        eventType: event.eventType,
        processingStatus,
        payload: event.payload,
        createdAt: now
      }).onConflictDoNothing().returning({ id: chainObservedEvents.id });
      insertedEvents += inserted.length;
    }

    await transaction.update(chainIndexerCursors)
      .set({ lastFinalizedSlot: input.toSlot, updatedAt: now })
      .where(eq(chainIndexerCursors.id, cursor.id));

    return {
      insertedEvents,
      lastFinalizedSlot: input.toSlot.toString(),
      replayed: false
    };
  });
}

export async function recordReconciliationDiscrepancy(
  db: Database,
  input: {
    network: "devnet";
    assetId?: string | null;
    transactionIntentId?: string | null;
    discrepancyType: string;
    expected: Record<string, unknown>;
    observed: Record<string, unknown>;
  }
): Promise<string> {
  if (!input.discrepancyType || input.discrepancyType.length > 64) {
    throw new TypeError("A reconciliation discrepancy type is required.");
  }
  const id = createUuidV7();
  await db.insert(chainReconciliationDiscrepancies).values({
    id,
    network: input.network,
    assetId: input.assetId ?? null,
    transactionIntentId: input.transactionIntentId ?? null,
    discrepancyType: input.discrepancyType,
    expected: input.expected,
    observed: input.observed,
    status: "open"
  });
  return id;
}

export async function getIndexerCursor(db: Database, network: "devnet", sourceKey = "network") {
  const [cursor] = await db.select().from(chainIndexerCursors)
    .where(and(eq(chainIndexerCursors.network, network), eq(chainIndexerCursors.sourceKey, sourceKey)))
    .limit(1);
  return cursor ? {
    network: cursor.network,
    lastFinalizedSlot: cursor.lastFinalizedSlot.toString(),
    updatedAt: cursor.updatedAt.toISOString()
  } : null;
}

export interface ChainTransactionObservation {
  signature: string;
  slot: bigint;
  commitment: "processed" | "confirmed" | "finalized";
  error: unknown | null;
}

export function compareTransactionObservation(
  expected: {
    status: string;
    signature: string | null;
    slot: bigint | null;
  },
  observed: ChainTransactionObservation
): Array<{ type: string; expected: Record<string, unknown>; observed: Record<string, unknown> }> {
  const discrepancies: Array<{ type: string; expected: Record<string, unknown>; observed: Record<string, unknown> }> = [];
  if (expected.signature && expected.signature !== observed.signature) {
    discrepancies.push({
      type: "chain_signature_mismatch",
      expected: { signature: expected.signature },
      observed: { signature: observed.signature }
    });
  }
  if (expected.slot !== null && expected.slot !== observed.slot) {
    discrepancies.push({
      type: "chain_slot_mismatch",
      expected: { slot: expected.slot.toString() },
      observed: { slot: observed.slot.toString() }
    });
  }
  if (expected.status === "finalized" && observed.commitment !== "finalized") {
    discrepancies.push({
      type: "chain_finality_mismatch",
      expected: { commitment: "finalized" },
      observed: { commitment: observed.commitment }
    });
  }
  if (expected.status === "finalized" && observed.error !== null) {
    discrepancies.push({
      type: "finalized_chain_failure",
      expected: { transactionStatus: "successful" },
      observed: { error: observed.error }
    });
  }
  return discrepancies;
}

export async function reconcileTransactionIntent(
  db: Database,
  input: {
    intentId: string;
    observation: ChainTransactionObservation;
  }
): Promise<{ discrepancyIds: string[] }> {
  const [intent] = await db.select().from(assetTransactionIntents)
    .where(eq(assetTransactionIntents.id, input.intentId))
    .limit(1);
  if (!intent) {
    const id = await recordReconciliationDiscrepancy(db, {
      network: "devnet",
      discrepancyType: "unmatched_chain_transaction",
      expected: { intentId: input.intentId },
      observed: {
        signature: input.observation.signature,
        slot: input.observation.slot.toString(),
        commitment: input.observation.commitment
      }
    });
    return { discrepancyIds: [id] };
  }

  const discrepancies = compareTransactionObservation({
    status: intent.status,
    signature: intent.chainSignature,
    slot: intent.chainSlot
  }, input.observation);
  const discrepancyIds: string[] = [];
  for (const discrepancy of discrepancies) {
    discrepancyIds.push(await recordReconciliationDiscrepancy(db, {
      network: "devnet",
      assetId: intent.assetId,
      transactionIntentId: intent.id,
      discrepancyType: discrepancy.type,
      expected: discrepancy.expected,
      observed: discrepancy.observed
    }));
  }
  return { discrepancyIds };
}

export class IndexerSourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexerSourceUnavailableError";
  }
}

export class IndexerBatchLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexerBatchLimitError";
  }
}

/**
 * Scans one token-account address with its own finalized slot cursor.
 * Pagination is bounded; callers should narrow the slot range if the page
 * budget is exhausted. The cursor advances only after the complete range is
 * read and all events are committed.
 */
export async function scanFinalizedAddressBatch(
  db: Database,
  gateway: SolanaGateway,
  input: {
    address: string;
    sourceKey: string;
    fromSlot: bigint;
    toSlot: bigint;
    maxPages?: number;
  }
): Promise<{ insertedEvents: number; lastFinalizedSlot: string; replayed: boolean }> {
  const maxPages = input.maxPages ?? 5;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) {
    throw new RangeError("Indexer page budget must be between 1 and 10.");
  }

  const events: FinalizedChainEvent[] = [];
  let before: string | undefined;
  let pages = 0;
  for (;;) {
    const page = await gateway.getSignaturesForAddress(input.address, before, 1000);
    if (page.length === 0) break;
    pages += 1;

    for (const record of page) {
      const slot = BigInt(record.slot);
      if (slot < input.fromSlot) continue;
      if (slot > input.toSlot || record.err !== null) continue;
      const transaction = await gateway.getTransaction(record.signature);
      if (transaction === null) {
        throw new IndexerSourceUnavailableError("A finalized transaction is not yet available from the RPC provider.");
      }
      if (!matchesFinalizedTransactionIdentity(transaction, record.signature, slot)) {
        throw new IndexerSourceUnavailableError("The RPC transaction identity does not match its finalized signature record.");
      }
      events.push(...decodeFinalizedClassicTokenEvents(record.signature, transaction));
    }

    const oldest = page[page.length - 1]!;
    if (BigInt(oldest.slot) < input.fromSlot || page.length < 1000) break;
    if (pages >= maxPages) {
      throw new IndexerBatchLimitError("The finalized signature page budget was exhausted; retry with a narrower slot range.");
    }
    before = oldest.signature;
  }

  return ingestFinalizedBatch(db, {
    network: "devnet",
    sourceKey: input.sourceKey,
    fromSlot: input.fromSlot,
    toSlot: input.toSlot,
    events
  });
}

export class IndexerAssetNotConfiguredError extends Error {
  constructor() {
    super("The BG asset does not have an active Devnet mint configuration.");
    this.name = "IndexerAssetNotConfiguredError";
  }
}

/**
 * Discovers token accounts owned by all wallets linked to BrightGlobe users,
 * adds explicitly configured operator owner addresses, then scans the
 * finalized signature history. The caller must include every operator vault
 * owner needed for complete reconciliation.
 */
export async function scanConfiguredBgAsset(
  db: Database,
  gateway: SolanaGateway,
  input: {
    fromSlot: bigint;
    toSlot: bigint;
    additionalOwnerAddresses?: readonly string[];
    maxSourcesPerRun?: number;
    maxSlotsPerSource?: bigint;
  }
): Promise<{
  sourcesScanned: number;
  sourcesRemaining: number;
  insertedEvents: number;
  targetFinalizedSlot: string;
  transactionStatusSync: { checked: number; confirmed: number; finalized: number; failed: number; expired: number };
}> {
  const maxSourcesPerRun = input.maxSourcesPerRun ?? 10;
  const maxSlotsPerSource = input.maxSlotsPerSource ?? 5000n;
  if (!Number.isInteger(maxSourcesPerRun) || maxSourcesPerRun < 1 || maxSourcesPerRun > 50) {
    throw new RangeError("Indexer source batch must be between 1 and 50 token accounts.");
  }
  if (maxSlotsPerSource < 1n || maxSlotsPerSource > 100_000n) {
    throw new RangeError("Indexer slot range per source must be between 1 and 100000 slots.");
  }
  if (input.fromSlot < 0n || input.toSlot < input.fromSlot) {
    throw new RangeError("Indexer slot range is invalid.");
  }

  const [asset] = await db.select().from(assetRegistry)
    .where(and(
      eq(assetRegistry.assetCode, "BG"),
      eq(assetRegistry.network, "devnet")
    ))
    .limit(1);
  if (!asset || asset.status !== "active" || !asset.mintAddress || asset.decimals === null) {
    throw new IndexerAssetNotConfiguredError();
  }
  const mintAddress = asset.mintAddress;
  const decimals = asset.decimals;
  if (asset.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID) {
    throw new IndexerAssetNotConfiguredError();
  }
  const mintAccount = await gateway.getAccountInfo(mintAddress, "finalized");
  if (!mintAccount.account) throw new IndexerAssetNotConfiguredError();
  const parsedMint = parseClassicSplMint({
    owner: mintAccount.account.owner,
    dataBase64: mintAccount.account.data[0]
  });
  if (parsedMint.decimals !== decimals) throw new IndexerAssetNotConfiguredError();

  const linkedWallets = await db.select({
    address: walletOwnerships.address,
    canonicalUserId: walletOwnerships.canonicalUserId
  }).from(walletOwnerships)
    .where(eq(walletOwnerships.network, "devnet"));
  const canonicalUserByWallet = new Map(
    linkedWallets.map((wallet) => [wallet.address, wallet.canonicalUserId] as const)
  );
  const ownerAddresses = [...new Set([
    ...linkedWallets.map((wallet) => wallet.address),
    ...(input.additionalOwnerAddresses ?? [])
  ])];
  if (ownerAddresses.length === 0) {
    throw new TypeError("No wallet or operator owner addresses are configured for BG indexing.");
  }

  // Persist discovered token accounts and establish a finalized opening
  // balance before scanning subsequent history. The snapshot slot is the
  // source cursor checkpoint, preventing historical activity from being
  // applied twice to the internal ledger.
  for (const ownerAddress of ownerAddresses) {
    const accounts = await gateway.getTokenAccountsByOwner(ownerAddress, mintAddress);
    for (const account of accounts) {
      await db.insert(chainIndexerSources).values({
        id: createUuidV7(),
        assetId: asset.id,
        network: "devnet",
        ownerAddress,
        tokenAccountAddress: account.address,
        firstSeenSlot: input.fromSlot,
        status: "active"
      }).onConflictDoNothing();

      const [source] = await db.select().from(chainIndexerSources)
        .where(and(
          eq(chainIndexerSources.network, "devnet"),
          eq(chainIndexerSources.tokenAccountAddress, account.address)
        ))
        .limit(1);
      if (!source || source.assetId !== asset.id || source.openingBalanceSlot !== null) continue;

      const accountInfo = await gateway.getAccountInfo(account.address, "finalized");
      if (!accountInfo.account) {
        await db.update(chainIndexerSources)
          .set({ status: "ignored", updatedAt: new Date() })
          .where(eq(chainIndexerSources.id, source.id));
        continue;
      }
      let parsedTokenAccount;
      try {
        parsedTokenAccount = parseClassicSplTokenAccount({
          owner: accountInfo.account.owner,
          dataBase64: accountInfo.account.data[0]
        });
      } catch {
        await db.update(chainIndexerSources)
          .set({ status: "ignored", updatedAt: new Date() })
          .where(eq(chainIndexerSources.id, source.id));
        continue;
      }
      if (
        parsedTokenAccount.owner !== ownerAddress ||
        parsedTokenAccount.mint !== mintAddress ||
        parsedTokenAccount.state === "uninitialized"
      ) {
        await db.update(chainIndexerSources)
          .set({ status: "ignored", updatedAt: new Date() })
          .where(eq(chainIndexerSources.id, source.id));
        continue;
      }

      await recordTokenAccountOpeningBalance(db, {
        sourceId: source.id,
        assetId: asset.id,
        network: "devnet",
        tokenAccountAddress: account.address,
        amountBaseUnits: parsedTokenAccount.amount,
        snapshotSlot: BigInt(accountInfo.contextSlot),
        canonicalUserId: canonicalUserByWallet.get(ownerAddress) ?? null
      });
    }
  }

  const sources = await db.select().from(chainIndexerSources)
    .where(and(
      eq(chainIndexerSources.assetId, asset.id),
      eq(chainIndexerSources.network, "devnet"),
      eq(chainIndexerSources.status, "active")
    ))
    .orderBy(asc(chainIndexerSources.tokenAccountAddress));

  if (sources.length === 0) {
    throw new TypeError("No BG token accounts were discovered for the configured owners.");
  }

  const cursors = await db.select({
    sourceKey: chainIndexerCursors.sourceKey,
    lastFinalizedSlot: chainIndexerCursors.lastFinalizedSlot
  }).from(chainIndexerCursors)
    .where(eq(chainIndexerCursors.network, "devnet"));
  const cursorBySource = new Map(cursors.map((cursor) => [cursor.sourceKey, cursor.lastFinalizedSlot] as const));

  const pending = sources.filter((source) => {
    const sourceKey = `BG:${source.tokenAccountAddress}`;
    const lastSlot = cursorBySource.get(sourceKey);
    return lastSlot === undefined || lastSlot < input.toSlot;
  });
  const batch = pending.slice(0, maxSourcesPerRun);

  let insertedEvents = 0;
  for (const source of batch) {
    const sourceKey = `BG:${source.tokenAccountAddress}`;
    const lastSlot = cursorBySource.get(sourceKey);
    const sourceFromSlot = lastSlot === undefined ? source.firstSeenSlot : lastSlot + 1n;
    if (sourceFromSlot > input.toSlot) continue;

    const sourceToSlot = input.toSlot < sourceFromSlot + maxSlotsPerSource - 1n
      ? input.toSlot
      : sourceFromSlot + maxSlotsPerSource - 1n;
    const result = await scanFinalizedAddressBatch(db, gateway, {
      address: source.tokenAccountAddress,
      sourceKey,
      fromSlot: sourceFromSlot,
      toSlot: sourceToSlot
    });
    insertedEvents += result.insertedEvents;
  }

  const transactionStatusSync = await syncPendingTransactionIntents(db, gateway);
  const eventSettlement = await processObservedBgAssetEvents(db, {
    assetId: asset.id,
    mintAddress,
    limit: 100
  });
  return {
    sourcesScanned: batch.length,
    sourcesRemaining: Math.max(0, pending.length - batch.length),
    insertedEvents,
    targetFinalizedSlot: input.toSlot.toString(),
    transactionStatusSync,
    eventSettlement
  };
}
