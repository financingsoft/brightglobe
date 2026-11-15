import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetAccounts,
  assetLedgerPostings,
  assetLedgerTransactions,
  chainIndexerCursors,
  chainIndexerSources
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";

const U64_MAX = 18446744073709551615n;

/**
 * Establish a one-time finalized on-chain balance baseline for a newly
 * discovered token account. The source row lock, ledger postings, snapshot
 * marker and cursor checkpoint are committed atomically.
 *
 * The system clearing account is the contra-account for an externally
 * acquired wallet balance. Future finalized transfer/mint/burn events update
 * the same user asset projection incrementally.
 */
export async function recordTokenAccountOpeningBalance(
  db: Database,
  input: {
    sourceId: string;
    assetId: string;
    network: "devnet";
    tokenAccountAddress: string;
    amountBaseUnits: bigint;
    snapshotSlot: bigint;
    canonicalUserId: string | null;
  }
): Promise<{ recorded: boolean }> {
  if (input.amountBaseUnits < 0n || input.amountBaseUnits > U64_MAX) {
    throw new RangeError("The token-account opening balance must fit in a u64.");
  }
  if (input.snapshotSlot < 0n) {
    throw new RangeError("The opening balance snapshot slot cannot be negative.");
  }

  return db.transaction(async (transaction) => {
    const [source] = await transaction.select().from(chainIndexerSources)
      .where(eq(chainIndexerSources.id, input.sourceId))
      .limit(1)
      .for("update");

    if (!source || source.assetId !== input.assetId || source.network !== input.network ||
        source.tokenAccountAddress !== input.tokenAccountAddress) {
      throw new Error("The token-account indexer source does not match the opening balance snapshot.");
    }
    if (source.openingBalanceSlot !== null) {
      return { recorded: false };
    }

    const now = new Date();
    if (input.canonicalUserId && input.amountBaseUnits > 0n) {
      await transaction.insert(assetAccounts).values({
        id: createUuidV7(now.getTime()),
        assetId: input.assetId,
        canonicalUserId: input.canonicalUserId,
        accountType: "user",
        balanceBaseUnits: 0n,
        createdAt: now,
        updatedAt: now
      }).onConflictDoNothing();

      await transaction.insert(assetAccounts).values({
        id: createUuidV7(now.getTime()),
        assetId: input.assetId,
        canonicalUserId: null,
        accountType: "system",
        balanceBaseUnits: 0n,
        createdAt: now,
        updatedAt: now
      }).onConflictDoNothing();

      const [userAccount] = await transaction.select().from(assetAccounts)
        .where(and(
          eq(assetAccounts.assetId, input.assetId),
          eq(assetAccounts.canonicalUserId, input.canonicalUserId),
          eq(assetAccounts.accountType, "user")
        ))
        .limit(1);
      const [systemAccount] = await transaction.select().from(assetAccounts)
        .where(and(
          eq(assetAccounts.assetId, input.assetId),
          eq(assetAccounts.accountType, "system")
        ))
        .limit(1);

      if (!userAccount || !systemAccount) {
        throw new Error("Unable to initialize the asset ledger accounts for the opening balance.");
      }

      const ledgerTransactionId = createUuidV7(now.getTime());
      await transaction.insert(assetLedgerTransactions).values({
        id: ledgerTransactionId,
        assetId: input.assetId,
        transactionType: "opening_balance",
        referenceType: "chain_indexer_source",
        referenceId: source.id,
        createdAt: now
      });

      await transaction.insert(assetLedgerPostings).values([
        {
          id: createUuidV7(now.getTime()),
          transactionId: ledgerTransactionId,
          accountId: systemAccount.id,
          deltaBaseUnits: -input.amountBaseUnits,
          createdAt: now
        },
        {
          id: createUuidV7(now.getTime()),
          transactionId: ledgerTransactionId,
          accountId: userAccount.id,
          deltaBaseUnits: input.amountBaseUnits,
          createdAt: now
        }
      ]);
    }

    await transaction.update(chainIndexerSources)
      .set({
        openingBalanceBaseUnits: input.amountBaseUnits,
        openingBalanceSlot: input.snapshotSlot,
        firstSeenSlot: input.snapshotSlot + 1n,
        updatedAt: now
      })
      .where(eq(chainIndexerSources.id, source.id));

    const sourceKey = "BG:" + input.tokenAccountAddress;
    await transaction.insert(chainIndexerCursors).values({
      id: createUuidV7(now.getTime()),
      network: input.network,
      sourceKey,
      lastFinalizedSlot: input.snapshotSlot,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [chainIndexerCursors.network, chainIndexerCursors.sourceKey],
      set: {
        lastFinalizedSlot: input.snapshotSlot,
        updatedAt: now
      }
    });

    return { recorded: true };
  });
}
