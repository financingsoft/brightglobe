import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  bgTreasuryReconciliationSnapshots,
  canonicalUsers,
  rewardEvents,
  rewardPayoutIntents,
  rewardPrograms,
  schema,
  treasuryAccounts
} from "../db/schema.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { createUuidV7 } from "../identity/ids.js";
import { createDrizzleBgTreasuryReconciliationRepository } from "./bg-treasury-reconciliation-repository.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;
const MINT = "So11111111111111111111111111111111111111112";
const TREASURY = "Stake11111111111111111111111111111111111111";
const TOKEN_ACCOUNT = "11111111111111111111111111111111";
const FEE_PAYER = "Vote111111111111111111111111111111111111111";
const DESTINATION = "SysvarRent111111111111111111111111111111111";
const DESTINATION_ATA = "ComputeBudget111111111111111111111111111111";

test("BG treasury snapshots are append-only, aggregate reserved/paid inventory and pause on discrepancy", {
  skip: !connectionString ? "LOCAL_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema }) as unknown as Database;
  const now = new Date();
  const assetId = createUuidV7(now.getTime());
  const canonicalUserId = createUuidV7(now.getTime());
  const treasuryAccountId = createUuidV7(now.getTime());
  const programId = createUuidV7(now.getTime());
  const reservedEventId = createUuidV7(now.getTime());
  const paidEventId = createUuidV7(now.getTime());
  const reservedPayoutId = createUuidV7(now.getTime());
  const paidPayoutId = createUuidV7(now.getTime());
  const assetCode = ("R" + assetId.replaceAll("-", "").slice(0, 15)).toUpperCase();
  const programKey = "bg-treasury-ci-" + programId.slice(0, 12);

  try {
    await db.insert(assetRegistry).values({
      id: assetId,
      assetCode,
      network: "devnet",
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      mintAddress: MINT,
      decimals: 9,
      status: "active",
      metadataSource: "verified",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(canonicalUsers).values({
      id: canonicalUserId,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(treasuryAccounts).values({
      id: treasuryAccountId,
      assetId,
      network: "devnet",
      mintAddress: MINT,
      treasuryWalletAddress: TREASURY,
      tokenAccountAddress: TOKEN_ACCOUNT,
      feePayerAddress: FEE_PAYER,
      signerProvider: "external",
      signerKeyReference: "external://ci/brightglobe/treasury",
      hotWalletCapBaseUnits: 1_000n,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardPrograms).values({
      id: programId,
      assetId,
      programKey,
      actionType: "campaign",
      ruleVersion: 1,
      status: "draft",
      rewardBaseUnits: 5n,
      perUserLimit: 10,
      budgetBaseUnits: 1_000n,
      reservedBaseUnits: 10n,
      paidBaseUnits: 5n,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: null,
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardEvents).values([
      {
        id: reservedEventId,
        programId,
        canonicalUserId,
        actionType: "campaign",
        evidenceRef: null,
        idempotencyKey: "bg-treasury-reserved:" + treasuryAccountId,
        amountBaseUnits: 10n,
        ruleVersion: 1,
        periodKey: null,
        status: "reserved",
        createdAt: now,
        updatedAt: now
      },
      {
        id: paidEventId,
        programId,
        canonicalUserId,
        actionType: "campaign",
        evidenceRef: null,
        idempotencyKey: "bg-treasury-paid:" + treasuryAccountId,
        amountBaseUnits: 5n,
        ruleVersion: 1,
        periodKey: null,
        status: "paid",
        createdAt: now,
        updatedAt: now
      }
    ]);
    await db.insert(rewardPayoutIntents).values([
      {
        id: reservedPayoutId,
        rewardEventId: reservedEventId,
        treasuryAccountId,
        network: "devnet",
        mintAddress: MINT,
        tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
        sourceTokenAccount: TOKEN_ACCOUNT,
        feePayerAddress: FEE_PAYER,
        treasuryAuthorityAddress: TREASURY,
        destinationWallet: DESTINATION,
        destinationTokenAccount: DESTINATION_ATA,
        amountBaseUnits: 10n,
        status: "queued",
        createdAt: now,
        updatedAt: now
      },
      {
        id: paidPayoutId,
        rewardEventId: paidEventId,
        treasuryAccountId,
        network: "devnet",
        mintAddress: MINT,
        tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
        sourceTokenAccount: TOKEN_ACCOUNT,
        feePayerAddress: FEE_PAYER,
        treasuryAuthorityAddress: TREASURY,
        destinationWallet: DESTINATION,
        destinationTokenAccount: DESTINATION_ATA,
        amountBaseUnits: 5n,
        status: "paid",
        chainSignature: "ci-finalized-bg-treasury-paid-signature",
        chainSlot: 123n,
        recentBlockhash: "11111111111111111111111111111111",
        lastValidBlockHeight: 500n,
        finalizedSlot: 123n,
        finalizedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]);

    const repository = createDrizzleBgTreasuryReconciliationRepository(db);
    const config = await repository.loadTreasuryAccount(treasuryAccountId);
    assert.deepEqual(config, {
      id: treasuryAccountId,
      network: "devnet",
      mintAddress: MINT,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      treasuryWalletAddress: TREASURY,
      tokenAccountAddress: TOKEN_ACCOUNT,
      decimals: 9
    });
    assert.deepEqual(await repository.getInventoryTotals(treasuryAccountId), {
      reservedBaseUnits: 10n,
      paidBaseUnits: 5n
    });

    const discrepancy = await repository.recordSnapshot({
      treasuryAccountId,
      network: "devnet",
      mintAddress: MINT,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      tokenAccountAddress: TOKEN_ACCOUNT,
      accountOwnerAddress: TREASURY,
      accountMintAddress: MINT,
      accountState: "initialized",
      observedSlot: 456n,
      tokenBalanceBaseUnits: 9n,
      reservedBaseUnits: 10n,
      paidBaseUnits: 5n,
      availableAfterReservationsBaseUnits: -1n,
      status: "insufficient_inventory",
      discrepancyCode: "treasury_balance_below_reserved_inventory",
      evidence: { finalizedAccountRead: true }
    });
    assert.equal(discrepancy.treasuryPaused, true);

    const [pausedTreasury] = await db.select().from(treasuryAccounts)
      .where(eq(treasuryAccounts.id, treasuryAccountId));
    assert.equal(pausedTreasury?.status, "paused");
    assert.ok(pausedTreasury?.lastReconciledAt);

    const matched = await repository.recordSnapshot({
      treasuryAccountId,
      network: "devnet",
      mintAddress: MINT,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      tokenAccountAddress: TOKEN_ACCOUNT,
      accountOwnerAddress: TREASURY,
      accountMintAddress: MINT,
      accountState: "initialized",
      observedSlot: 457n,
      tokenBalanceBaseUnits: 30n,
      reservedBaseUnits: 10n,
      paidBaseUnits: 5n,
      availableAfterReservationsBaseUnits: 20n,
      status: "matched",
      discrepancyCode: null,
      evidence: { finalizedAccountRead: true }
    });
    assert.equal(matched.treasuryPaused, true, "a healthy snapshot must never auto-resume an operator-paused treasury");

    const snapshots = await db.select().from(bgTreasuryReconciliationSnapshots)
      .where(eq(bgTreasuryReconciliationSnapshots.treasuryAccountId, treasuryAccountId));
    assert.equal(snapshots.length, 2);
    assert.deepEqual(snapshots.map((snapshot) => snapshot.status).sort(), [
      "insufficient_inventory",
      "matched"
    ]);

    await assert.rejects(
      db.update(bgTreasuryReconciliationSnapshots)
        .set({ status: "matched" })
        .where(eq(bgTreasuryReconciliationSnapshots.id, discrepancy.snapshotId)),
      /append-only/
    );
    await assert.rejects(
      db.delete(bgTreasuryReconciliationSnapshots)
        .where(eq(bgTreasuryReconciliationSnapshots.id, discrepancy.snapshotId)),
      /append-only/
    );
  } finally {
    await pool.end();
  }
});
