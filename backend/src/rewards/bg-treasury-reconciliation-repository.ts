import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  bgTreasuryReconciliationSnapshots,
  rewardAuditEvents,
  rewardPayoutIntents,
  treasuryAccounts
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import type {
  BgTreasuryAccountForReconciliation,
  BgTreasuryInventoryTotals,
  BgTreasuryReconciliationRepository,
  BgTreasurySnapshotInput
} from "./bg-treasury-reconciler.js";

const RESERVED_PAYOUT_STATUSES = [
  "queued",
  "signing",
  "signed",
  "submitted",
  "confirmed",
  "finalized",
  "reconciliation_required",
  "quarantined"
] as const;

export function createDrizzleBgTreasuryReconciliationRepository(
  db: Database
): BgTreasuryReconciliationRepository {
  return {
    async loadTreasuryAccount(treasuryAccountId): Promise<BgTreasuryAccountForReconciliation | null> {
      const [row] = await db.select({
        id: treasuryAccounts.id,
        network: treasuryAccounts.network,
        mintAddress: treasuryAccounts.mintAddress,
        tokenProgram: assetRegistry.tokenProgram,
        treasuryWalletAddress: treasuryAccounts.treasuryWalletAddress,
        tokenAccountAddress: treasuryAccounts.tokenAccountAddress,
        decimals: assetRegistry.decimals
      }).from(treasuryAccounts)
        .innerJoin(assetRegistry, eq(assetRegistry.id, treasuryAccounts.assetId))
        .where(eq(treasuryAccounts.id, treasuryAccountId))
        .limit(1);
      if (!row) return null;
      return row;
    },

    async getInventoryTotals(treasuryAccountId): Promise<BgTreasuryInventoryTotals> {
      const [reserved] = await db.select({
        amount: sql<string>`coalesce(sum(${rewardPayoutIntents.amountBaseUnits}), 0)::text`
      }).from(rewardPayoutIntents)
        .where(and(
          eq(rewardPayoutIntents.treasuryAccountId, treasuryAccountId),
          inArray(rewardPayoutIntents.status, [...RESERVED_PAYOUT_STATUSES])
        ));
      const [paid] = await db.select({
        amount: sql<string>`coalesce(sum(${rewardPayoutIntents.amountBaseUnits}), 0)::text`
      }).from(rewardPayoutIntents)
        .where(and(
          eq(rewardPayoutIntents.treasuryAccountId, treasuryAccountId),
          eq(rewardPayoutIntents.status, "paid")
        ));
      return {
        reservedBaseUnits: BigInt(reserved?.amount ?? "0"),
        paidBaseUnits: BigInt(paid?.amount ?? "0")
      };
    },

    async recordSnapshot(snapshot: BgTreasurySnapshotInput): Promise<{ snapshotId: string; treasuryPaused: boolean }> {
      return db.transaction(async (tx) => {
        const [treasury] = await tx.select({
          id: treasuryAccounts.id,
          status: treasuryAccounts.status
        }).from(treasuryAccounts)
          .where(eq(treasuryAccounts.id, snapshot.treasuryAccountId))
          .limit(1)
          .for("update");
        if (!treasury) throw new Error("BG treasury account disappeared during reconciliation.");

        const now = new Date();
        const snapshotId = createUuidV7(now.getTime());
        await tx.insert(bgTreasuryReconciliationSnapshots).values({
          id: snapshotId,
          treasuryAccountId: snapshot.treasuryAccountId,
          network: snapshot.network,
          mintAddress: snapshot.mintAddress,
          tokenProgram: snapshot.tokenProgram,
          tokenAccountAddress: snapshot.tokenAccountAddress,
          accountOwnerAddress: snapshot.accountOwnerAddress,
          accountMintAddress: snapshot.accountMintAddress,
          accountState: snapshot.accountState,
          observedSlot: snapshot.observedSlot,
          tokenBalanceBaseUnits: snapshot.tokenBalanceBaseUnits,
          reservedBaseUnits: snapshot.reservedBaseUnits,
          paidBaseUnits: snapshot.paidBaseUnits,
          availableAfterReservationsBaseUnits: snapshot.availableAfterReservationsBaseUnits,
          status: snapshot.status,
          discrepancyCode: snapshot.discrepancyCode,
          evidence: snapshot.evidence,
          createdAt: now
        });

        const shouldPause = snapshot.status !== "matched" && treasury.status === "active";
        await tx.update(treasuryAccounts)
          .set({
            lastReconciledAt: now,
            ...(shouldPause ? { status: "paused" } : {}),
            updatedAt: now
          })
          .where(eq(treasuryAccounts.id, snapshot.treasuryAccountId));

        if (snapshot.status !== "matched") {
          await tx.insert(rewardAuditEvents).values({
            id: createUuidV7(now.getTime() + 1),
            actorType: "service",
            actorId: "bg-treasury-reconciler",
            action: shouldPause ? "bg.treasury.reconciliation.paused" : "bg.treasury.reconciliation.discrepancy",
            targetType: "treasury_account",
            targetId: snapshot.treasuryAccountId,
            reason: "BG treasury inventory reconciliation did not produce a clean matched snapshot.",
            metadata: {
              snapshotId,
              status: snapshot.status,
              discrepancyCode: snapshot.discrepancyCode,
              reservedBaseUnits: snapshot.reservedBaseUnits.toString(),
              paidBaseUnits: snapshot.paidBaseUnits.toString(),
              tokenBalanceBaseUnits: snapshot.tokenBalanceBaseUnits?.toString() ?? null
            },
            createdAt: now
          });
        }
        return { snapshotId, treasuryPaused: shouldPause || treasury.status === "paused" };
      });
    }
  };
}
