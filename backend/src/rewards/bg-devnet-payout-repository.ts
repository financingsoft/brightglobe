import { and, asc, eq, gte, gt, inArray, isNotNull, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  rewardAuditEvents,
  rewardEvents,
  rewardPayoutIntents,
  rewardPrograms,
  treasuryAccounts
} from "../db/schema.js";
import {
  getOrCreateSystemAssetAccount,
  postLedgerTransaction
} from "../assets/ledger/ledger-service.js";
import { getOrCreateUserAssetAccount } from "../assets/asset-service.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  assertBgPayoutTransition,
  type BgPayoutStatus,
  type BgPayoutTransitionEvidence
} from "./bg-payout-lifecycle.js";
import type {
  BgDevnetPayoutIntent,
  BgDevnetPayoutRepository
} from "./bg-devnet-payout-executor.js";

const ACTIVE_OUTFLOW_STATUSES = [
  "signing",
  "signed",
  "submitted",
  "confirmed",
  "finalized",
  "paid",
  "reconciliation_required"
] as const;

function isSignerProvider(value: string): value is "kms" | "hsm" | "external" {
  return value === "kms" || value === "hsm" || value === "external";
}

function eventStatusForPayout(status: string): string | null {
  if (status === "submitted" || status === "confirmed" || status === "finalized" ||
      status === "paid" || status === "reconciliation_required" || status === "failed" ||
      status === "expired" || status === "quarantined" || status === "cancelled") return status;
  return null;
}

/**
 * Neon/Drizzle implementation of the payout repository port.
 *
 * Claims are serialized per treasury account, signatures are persisted with a
 * compare-and-set update before any caller can broadcast, and the finalized
 * reward ledger credit plus payout/program state changes commit atomically.
 */
export function createDrizzleBgDevnetPayoutRepository(db: Database): BgDevnetPayoutRepository {
  return {
    async claimNextQueued(workerId: string): Promise<BgDevnetPayoutIntent | null> {
      if (!workerId || workerId.length > 128) throw new TypeError("Invalid payout worker ID.");
      return db.transaction(async (tx) => {
        const [candidate] = await tx.select({
          payout: rewardPayoutIntents,
          event: rewardEvents,
          program: rewardPrograms,
          treasury: treasuryAccounts,
          asset: assetRegistry
        }).from(rewardPayoutIntents)
          .innerJoin(rewardEvents, eq(rewardEvents.id, rewardPayoutIntents.rewardEventId))
          .innerJoin(rewardPrograms, eq(rewardPrograms.id, rewardEvents.programId))
          .innerJoin(treasuryAccounts, eq(treasuryAccounts.id, rewardPayoutIntents.treasuryAccountId))
          .innerJoin(assetRegistry, eq(assetRegistry.id, rewardPrograms.assetId))
          .where(and(
            eq(rewardPayoutIntents.status, "queued"),
            eq(rewardPayoutIntents.network, "devnet"),
            eq(treasuryAccounts.network, "devnet"),
            eq(treasuryAccounts.status, "active"),
            inArray(treasuryAccounts.signerProvider, ["kms", "hsm", "external"]),
            isNotNull(treasuryAccounts.signerKeyReference),
            gt(treasuryAccounts.hotWalletCapBaseUnits, 0n),
            eq(assetRegistry.network, "devnet"),
            eq(assetRegistry.status, "active"),
            isNotNull(assetRegistry.mintAddress),
            eq(assetRegistry.mintAddress, rewardPayoutIntents.mintAddress),
            eq(assetRegistry.tokenProgram, rewardPayoutIntents.tokenProgram)
          ))
          .orderBy(asc(rewardPayoutIntents.createdAt))
          .limit(1)
          .for("update", { skipLocked: true });

        if (!candidate) return null;

        // Lock the treasury configuration row as the rolling-outflow serialization
        // point so concurrent workers cannot both spend the same hot-wallet budget.
        const [treasuryLock] = await tx.select({ id: treasuryAccounts.id })
          .from(treasuryAccounts)
          .where(eq(treasuryAccounts.id, candidate.treasury.id))
          .for("update");
        if (!treasuryLock) return null;

        const now = new Date();
        const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const [outflowRow] = await tx.select({
          amount: sql<string>`coalesce(sum(${rewardPayoutIntents.amountBaseUnits}), 0)::text`
        }).from(rewardPayoutIntents)
          .where(and(
            eq(rewardPayoutIntents.treasuryAccountId, candidate.treasury.id),
            gte(rewardPayoutIntents.createdAt, windowStart),
            inArray(rewardPayoutIntents.status, [...ACTIVE_OUTFLOW_STATUSES])
          ));
        const rollingOutflow = BigInt(outflowRow?.amount ?? "0");
        const cap = candidate.treasury.hotWalletCapBaseUnits;
        const remaining = cap > rollingOutflow ? cap - rollingOutflow : 0n;
        if (
          !isSignerProvider(candidate.treasury.signerProvider) ||
          !candidate.treasury.signerKeyReference ||
          !candidate.asset.decimals ||
          candidate.payout.amountBaseUnits > remaining
        ) return null;

        const [claimed] = await tx.update(rewardPayoutIntents)
          .set({ status: "signing", updatedAt: now })
          .where(and(
            eq(rewardPayoutIntents.id, candidate.payout.id),
            eq(rewardPayoutIntents.status, "queued")
          ))
          .returning({ id: rewardPayoutIntents.id });
        if (!claimed) return null;

        await tx.insert(rewardAuditEvents).values({
          id: createUuidV7(now.getTime()),
          actorType: "service",
          actorId: workerId,
          action: "bg.reward.payout.claimed",
          targetType: "reward_payout_intent",
          targetId: candidate.payout.id,
          reason: "Queued Devnet payout atomically claimed by one worker.",
          metadata: { workerId, treasuryAccountId: candidate.treasury.id },
          createdAt: now
        });

        return {
          id: candidate.payout.id,
          network: candidate.payout.network,
          mintAddress: candidate.payout.mintAddress,
          tokenProgram: candidate.payout.tokenProgram,
          sourceTokenAccount: candidate.payout.sourceTokenAccount,
          feePayerAddress: candidate.payout.feePayerAddress,
          treasuryAuthorityAddress: candidate.payout.treasuryAuthorityAddress,
          destinationWallet: candidate.payout.destinationWallet,
          destinationTokenAccount: candidate.payout.destinationTokenAccount,
          amountBaseUnits: candidate.payout.amountBaseUnits,
          signerProvider: candidate.treasury.signerProvider,
          signerKeyReference: candidate.treasury.signerKeyReference,
          decimals: candidate.asset.decimals,
          maxSinglePayoutBaseUnits: cap,
          remainingRollingOutflowBaseUnits: remaining
        };
      });
    },

    async persistSigned(input): Promise<boolean> {
      const now = new Date();
      const rows = await db.update(rewardPayoutIntents)
        .set({
          status: "signed",
          chainSignature: input.signature,
          recentBlockhash: input.recentBlockhash,
          lastValidBlockHeight: input.lastValidBlockHeight,
          updatedAt: now
        })
        .where(and(
          eq(rewardPayoutIntents.id, input.payoutIntentId),
          eq(rewardPayoutIntents.status, "signing"),
          sql`${rewardPayoutIntents.chainSignature} IS NULL`
        ))
        .returning({ id: rewardPayoutIntents.id });
      return rows.length === 1;
    },

    async transition(input): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [current] = await tx.select().from(rewardPayoutIntents)
          .where(eq(rewardPayoutIntents.id, input.payoutIntentId))
          .limit(1)
          .for("update");
        if (!current || current.status !== input.from) return false;

        assertBgPayoutTransition(
          input.from as BgPayoutStatus,
          input.to as BgPayoutStatus,
          input.evidence as BgPayoutTransitionEvidence
        );

        const now = new Date();
        const metadata = { ...current.reconciliationMetadata, ...input.evidence };
        const patch: Partial<typeof rewardPayoutIntents.$inferInsert> = {
          status: input.to,
          reconciliationMetadata: metadata,
          lastErrorCode: input.errorCode ?? null,
          updatedAt: now
        };
        if (input.signature) patch.chainSignature = input.signature;
        if (input.to === "submitted") patch.submittedAt = now;
        if (input.to === "confirmed" && input.slot !== undefined) patch.confirmedSlot = input.slot;
        if (input.to === "finalized" && input.slot !== undefined) {
          patch.chainSlot = input.slot;
          patch.finalizedSlot = input.slot;
          patch.finalizedAt = now;
        }

        const updated = await tx.update(rewardPayoutIntents)
          .set(patch)
          .where(and(
            eq(rewardPayoutIntents.id, input.payoutIntentId),
            eq(rewardPayoutIntents.status, input.from)
          ))
          .returning({ id: rewardPayoutIntents.id });
        if (updated.length !== 1) return false;

        const eventStatus = eventStatusForPayout(input.to);
        if (eventStatus) {
          await tx.update(rewardEvents)
            .set({ status: eventStatus, updatedAt: now })
            .where(eq(rewardEvents.id, current.rewardEventId));
        }
        await tx.insert(rewardAuditEvents).values({
          id: createUuidV7(now.getTime()),
          actorType: "service",
          action: "bg.reward.payout.transitioned",
          targetType: "reward_payout_intent",
          targetId: input.payoutIntentId,
          reason: `BG payout transitioned from ${input.from} to ${input.to}.`,
          metadata: {
            ...(input.signature ? { signature: input.signature } : {}),
            ...(input.slot !== undefined ? { slot: input.slot.toString() } : {}),
            ...(input.errorCode ? { errorCode: input.errorCode } : {}),
            evidence: input.evidence
          },
          createdAt: now
        });
        return true;
      });
    },

    async settleFinalizedPayoutOnce(input): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [row] = await tx.select({
          payout: rewardPayoutIntents,
          event: rewardEvents,
          program: rewardPrograms
        }).from(rewardPayoutIntents)
          .innerJoin(rewardEvents, eq(rewardEvents.id, rewardPayoutIntents.rewardEventId))
          .innerJoin(rewardPrograms, eq(rewardPrograms.id, rewardEvents.programId))
          .where(eq(rewardPayoutIntents.id, input.payoutIntentId))
          .limit(1)
          .for("update");
        if (!row) throw new Error("BG payout intent was not found during settlement.");
        if (row.payout.status === "paid") return true;
        if (
          row.payout.status !== "finalized" ||
          row.payout.chainSignature !== input.signature ||
          row.payout.finalizedSlot !== input.finalizedSlot ||
          row.event.status !== "finalized" ||
          row.program.reservedBaseUnits < row.payout.amountBaseUnits
        ) throw new Error("Finalized BG payout evidence or reserved program budget does not match.");

        const transactionDb = tx as unknown as Database;
        const userAccount = await getOrCreateUserAssetAccount(transactionDb, {
          canonicalUserId: row.event.canonicalUserId,
          assetId: row.program.assetId
        });
        const systemAccount = await getOrCreateSystemAssetAccount(transactionDb, row.program.assetId);
        await postLedgerTransaction(transactionDb, {
          canonicalUserId: row.event.canonicalUserId,
          assetId: row.program.assetId,
          operation: "bg_reward_payout_settlement",
          idempotencyKey: row.payout.id,
          transactionType: "bg_reward_payout",
          referenceType: "reward_payout_intent",
          referenceId: row.payout.id,
          postings: [
            { accountId: systemAccount.id, deltaBaseUnits: -row.payout.amountBaseUnits },
            { accountId: userAccount.id, deltaBaseUnits: row.payout.amountBaseUnits }
          ]
        });

        const now = new Date();
        const [programUpdated] = await tx.update(rewardPrograms)
          .set({
            reservedBaseUnits: sql`${rewardPrograms.reservedBaseUnits} - ${row.payout.amountBaseUnits}`,
            paidBaseUnits: sql`${rewardPrograms.paidBaseUnits} + ${row.payout.amountBaseUnits}`,
            updatedAt: now
          })
          .where(and(
            eq(rewardPrograms.id, row.program.id),
            gte(rewardPrograms.reservedBaseUnits, row.payout.amountBaseUnits)
          ))
          .returning({ id: rewardPrograms.id });
        if (!programUpdated) throw new Error("BG reward program reservation could not be settled.");

        await tx.update(rewardEvents)
          .set({ status: "paid", updatedAt: now })
          .where(and(eq(rewardEvents.id, row.event.id), eq(rewardEvents.status, "finalized")));
        const [payoutUpdated] = await tx.update(rewardPayoutIntents)
          .set({ status: "paid", updatedAt: now })
          .where(and(
            eq(rewardPayoutIntents.id, row.payout.id),
            eq(rewardPayoutIntents.status, "finalized"),
            eq(rewardPayoutIntents.chainSignature, input.signature),
            eq(rewardPayoutIntents.finalizedSlot, input.finalizedSlot)
          ))
          .returning({ id: rewardPayoutIntents.id });
        if (!payoutUpdated) throw new Error("BG payout status changed during ledger settlement.");

        await tx.insert(rewardAuditEvents).values({
          id: createUuidV7(now.getTime()),
          actorType: "service",
          action: "bg.reward.payout.paid",
          targetType: "reward_payout_intent",
          targetId: row.payout.id,
          reason: "Finalized Devnet BG transfer and internal ledger settlement committed atomically.",
          metadata: {
            signature: input.signature,
            finalizedSlot: input.finalizedSlot.toString(),
            amountBaseUnits: row.payout.amountBaseUnits.toString(),
            ledgerOperation: "bg_reward_payout_settlement"
          },
          createdAt: now
        });
        return true;
      });
    }
  };
}
