import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetTransactionIntents,
  chainIndexerSources,
  chainObservedEvents,
  chainReconciliationDiscrepancies,
  walletOwnerships
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  getOrCreateSystemAssetAccount,
  postLedgerTransaction
} from "../assets/ledger/ledger-service.js";
import { getOrCreateUserAssetAccount } from "../assets/asset-service.js";

type SourceSnapshot = {
  tokenAccountAddress: string;
  ownerAddress: string;
  openingBalanceSlot: bigint | null;
};

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function readAmount(payload: Record<string, unknown>): bigint | null {
  const raw = payload.amountBaseUnits;
  if (typeof raw !== "string" || !/^(0|[1-9][0-9]*)$/.test(raw)) return null;
  const amount = BigInt(raw);
  return amount > 0n && amount <= 18446744073709551615n ? amount : null;
}

async function setEventStatus(
  db: Database,
  eventId: string,
  status: "processed" | "ignored" | "quarantined"
): Promise<void> {
  await db.update(chainObservedEvents)
    .set({ processingStatus: status })
    .where(eq(chainObservedEvents.id, eventId));
}

async function recordEventDiscrepancy(
  db: Database,
  input: {
    signature: string;
    slot: bigint;
    eventType: string;
    eventId: string;
    reason: string;
    payload: Record<string, unknown>;
    expected?: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(chainReconciliationDiscrepancies).values({
    id: createUuidV7(),
    network: "devnet",
    discrepancyType: "chain_event_ledger_settlement_failed",
    expected: {
      eventId: input.eventId,
      signature: input.signature,
      slot: input.slot.toString(),
      eventType: input.eventType,
      reason: input.reason,
      ...(input.expected ?? {})
    },
    observed: input.payload,
    status: "open"
  });
}

/**
 * Projects finalized classic SPL Token activity into BrightGlobe's internal
 * BG ledger. Chain observations are authoritative; ledger rows are an
 * idempotent accounting projection. Transactions already represented by a
 * BrightGlobe intent are settled by the intent lifecycle and skipped here.
 */
export async function processObservedBgAssetEvents(
  db: Database,
  input: { assetId: string; mintAddress: string; limit?: number }
): Promise<{
  checked: number;
  processed: number;
  ignored: number;
  quarantined: number;
}> {
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError("The chain event settlement batch must be between 1 and 500.");
  }

  const sourceRows = await db.select({
    tokenAccountAddress: chainIndexerSources.tokenAccountAddress,
    ownerAddress: chainIndexerSources.ownerAddress,
    openingBalanceSlot: chainIndexerSources.openingBalanceSlot
  }).from(chainIndexerSources)
    .where(and(
      eq(chainIndexerSources.assetId, input.assetId),
      eq(chainIndexerSources.network, "devnet"),
      eq(chainIndexerSources.status, "active")
    ));

  const sourceByTokenAccount = new Map<string, SourceSnapshot>(
    sourceRows.map((source) => [source.tokenAccountAddress, source] as const)
  );
  if (sourceByTokenAccount.size === 0) {
    return { checked: 0, processed: 0, ignored: 0, quarantined: 0 };
  }

  const walletRows = await db.select({
    address: walletOwnerships.address,
    canonicalUserId: walletOwnerships.canonicalUserId
  }).from(walletOwnerships)
    .where(eq(walletOwnerships.network, "devnet"));
  const userByWallet = new Map(walletRows.map((wallet) => [wallet.address, wallet.canonicalUserId] as const));

  const events = await db.select().from(chainObservedEvents)
    .where(and(
      eq(chainObservedEvents.network, "devnet"),
      eq(chainObservedEvents.processingStatus, "observed")
    ))
    .orderBy(
      asc(chainObservedEvents.slot),
      asc(chainObservedEvents.signature),
      asc(chainObservedEvents.instructionIndex),
      asc(chainObservedEvents.eventIndex)
    )
    .limit(limit);

  if (events.length === 0) return { checked: 0, processed: 0, ignored: 0, quarantined: 0 };

  const signatures = [...new Set(events.map((event) => event.signature))];
  const matchingIntents = await db.select({
    chainSignature: assetTransactionIntents.chainSignature
  }).from(assetTransactionIntents)
    .where(and(
      eq(assetTransactionIntents.assetId, input.assetId),
      inArray(assetTransactionIntents.chainSignature, signatures)
    ));
  const intentSignatures = new Set(
    matchingIntents.flatMap((intent) => intent.chainSignature ? [intent.chainSignature] : [])
  );

  let processed = 0;
  let ignored = 0;
  let quarantined = 0;

  for (const event of events) {
    const payload = event.payload;
    const touchesTrackedBgAccount = event.eventType === "transfer"
      ? Boolean(
          sourceByTokenAccount.has(readString(payload, "source") ?? "") ||
          sourceByTokenAccount.has(readString(payload, "destination") ?? "")
        )
      : event.eventType === "mint_to" || event.eventType === "burn"
        ? sourceByTokenAccount.has(readString(payload, "account") ?? "")
        : false;
    if (!touchesTrackedBgAccount) {
      await setEventStatus(db, event.id, "ignored");
      ignored += 1;
      continue;
    }

    const payloadMint = readString(payload, "mint");
    if (payloadMint && payloadMint !== input.mintAddress) {
      await recordEventDiscrepancy(db, {
        eventId: event.id,
        signature: event.signature,
        slot: event.slot,
        eventType: event.eventType,
        reason: "observed_mint_does_not_match_registered_BG_mint",
        payload,
        expected: { mintAddress: input.mintAddress }
      });
      await setEventStatus(db, event.id, "quarantined");
      quarantined += 1;
      continue;
    }

    // The transaction-intent reconciler independently validates the complete
    // finalized envelope, exact transfer and intent, then posts the ledger.
    if (intentSignatures.has(event.signature)) {
      await setEventStatus(db, event.id, "ignored");
      ignored += 1;
      continue;
    }

    const amount = readAmount(payload);
    if (!amount) {
      await recordEventDiscrepancy(db, {
        eventId: event.id,
        signature: event.signature,
        slot: event.slot,
        eventType: event.eventType,
        reason: "invalid_or_out_of_range_token_amount",
        payload
      });
      await setEventStatus(db, event.id, "quarantined");
      quarantined += 1;
      continue;
    }

    let postings: Array<{ accountId: string; deltaBaseUnits: bigint }> = [];
    let ledgerOwnerId: string | null = null;
    let counterpartyUserIds: string[] = [];

    if (event.eventType === "transfer") {
      const sourceAddress = readString(payload, "source");
      const destinationAddress = readString(payload, "destination");
      if (!sourceAddress || !destinationAddress) {
        await recordEventDiscrepancy(db, {
          eventId: event.id,
          signature: event.signature,
          slot: event.slot,
          eventType: event.eventType,
          reason: "transfer_event_missing_source_or_destination",
          payload
        });
        await setEventStatus(db, event.id, "quarantined");
        quarantined += 1;
        continue;
      }

      const source = sourceByTokenAccount.get(sourceAddress);
      const destination = sourceByTokenAccount.get(destinationAddress);
      // A newly discovered source is not eligible for ledger projection until
      // its opening balance is captured; leave the event pending for the next
      // indexed run instead of risking a snapshot/event double count.
      if (
        (source && source.openingBalanceSlot === null) ||
        (destination && destination.openingBalanceSlot === null)
      ) continue;
      if (!source && !destination) {
        await setEventStatus(db, event.id, "ignored");
        ignored += 1;
        continue;
      }

      const sourceUserId = source ? userByWallet.get(source.ownerAddress) ?? null : null;
      const destinationUserId = destination ? userByWallet.get(destination.ownerAddress) ?? null : null;
      if (sourceUserId && sourceUserId === destinationUserId) {
        await setEventStatus(db, event.id, "ignored");
        ignored += 1;
        continue;
      }

      const sourceIncluded = Boolean(
        source?.openingBalanceSlot !== null &&
        source?.openingBalanceSlot !== undefined &&
        event.slot <= source.openingBalanceSlot
      );
      const destinationIncluded = Boolean(
        destination?.openingBalanceSlot !== null &&
        destination?.openingBalanceSlot !== undefined &&
        event.slot <= destination.openingBalanceSlot
      );

      if (sourceIncluded && destinationIncluded) {
        await setEventStatus(db, event.id, "ignored");
        ignored += 1;
        continue;
      }

      const systemAccount = await getOrCreateSystemAssetAccount(db, input.assetId);
      const sourceAccount = sourceIncluded || !sourceUserId
        ? systemAccount
        : await getOrCreateUserAssetAccount(db, {
            canonicalUserId: sourceUserId,
            assetId: input.assetId
          });
      const destinationAccount = destinationIncluded || !destinationUserId
        ? systemAccount
        : await getOrCreateUserAssetAccount(db, {
            canonicalUserId: destinationUserId,
            assetId: input.assetId
          });

      if (sourceAccount.id === destinationAccount.id) {
        await setEventStatus(db, event.id, "ignored");
        ignored += 1;
        continue;
      }

      postings = [
        { accountId: sourceAccount.id, deltaBaseUnits: -amount },
        { accountId: destinationAccount.id, deltaBaseUnits: amount }
      ];
      ledgerOwnerId = destinationUserId ?? sourceUserId;
      counterpartyUserIds = [sourceUserId, destinationUserId].filter(
        (userId): userId is string => userId !== null
      );
    } else if (event.eventType === "mint_to" || event.eventType === "burn") {
      const tokenAccountAddress = readString(payload, "account");
      const source = tokenAccountAddress
        ? sourceByTokenAccount.get(tokenAccountAddress)
        : undefined;
      if (!source) {
        await setEventStatus(db, event.id, "ignored");
        ignored += 1;
        continue;
      }
      if (source.openingBalanceSlot === null) continue;
      const userId = userByWallet.get(source.ownerAddress) ?? null;
      if (!userId) {
        await setEventStatus(db, event.id, "ignored");
        ignored += 1;
        continue;
      }
      if (
        source.openingBalanceSlot !== null &&
        source.openingBalanceSlot !== undefined &&
        event.slot <= source.openingBalanceSlot
      ) {
        await setEventStatus(db, event.id, "ignored");
        ignored += 1;
        continue;
      }

      const userAccount = await getOrCreateUserAssetAccount(db, {
        canonicalUserId: userId,
        assetId: input.assetId
      });
      const systemAccount = await getOrCreateSystemAssetAccount(db, input.assetId);
      postings = event.eventType === "mint_to"
        ? [
            { accountId: systemAccount.id, deltaBaseUnits: -amount },
            { accountId: userAccount.id, deltaBaseUnits: amount }
          ]
        : [
            { accountId: userAccount.id, deltaBaseUnits: -amount },
            { accountId: systemAccount.id, deltaBaseUnits: amount }
          ];
      ledgerOwnerId = userId;
      counterpartyUserIds = [];
    } else {
      await setEventStatus(db, event.id, "ignored");
      ignored += 1;
      continue;
    }

    if (!ledgerOwnerId || postings.length !== 2) {
      await setEventStatus(db, event.id, "ignored");
      ignored += 1;
      continue;
    }

    try {
      await postLedgerTransaction(db, {
        canonicalUserId: ledgerOwnerId,
        assetId: input.assetId,
        operation: "indexed_chain_event",
        idempotencyKey: event.id,
        transactionType: event.eventType,
        referenceType: "chain_observed_event",
        referenceId: event.id,
        postings,
        counterpartyUserIds
      });
      await setEventStatus(db, event.id, "processed");
      processed += 1;
    } catch (error) {
      await recordEventDiscrepancy(db, {
        eventId: event.id,
        signature: event.signature,
        slot: event.slot,
        eventType: event.eventType,
        reason: error instanceof Error ? error.message : "unknown_ledger_settlement_error",
        payload,
        expected: { amountBaseUnits: amount.toString() }
      });
      await setEventStatus(db, event.id, "quarantined");
      quarantined += 1;
    }
  }

  return { checked: events.length, processed, ignored, quarantined };
}
