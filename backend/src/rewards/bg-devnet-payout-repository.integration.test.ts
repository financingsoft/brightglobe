import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetAccounts,
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
import { createDrizzleBgDevnetPayoutRepository } from "./bg-devnet-payout-repository.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

function testAddress(seed: number): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes = new Uint8Array(32);
  let value = BigInt(seed);
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
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

test("Neon BG payout repository claims once and settles the reward ledger atomically", {
  skip: !connectionString ? "LOCAL_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema }) as unknown as Database;
  const now = new Date();
  const id = createUuidV7(now.getTime());
  const assetId = createUuidV7(now.getTime());
  const canonicalUserId = createUuidV7(now.getTime());
  const treasuryAccountId = createUuidV7(now.getTime());
  const programId = createUuidV7(now.getTime());
  const eventId = createUuidV7(now.getTime());
  const payoutId = createUuidV7(now.getTime());
  const mintAddress = testAddress(900_001);
  const treasuryWalletAddress = testAddress(900_002);
  const sourceTokenAccount = testAddress(900_003);
  const feePayerAddress = testAddress(900_004);
  const destinationWallet = testAddress(900_005);
  const destinationTokenAccount = testAddress(900_006);
  const amount = 100n;
  const assetCode = ("T" + assetId.replaceAll("-", "").slice(0, 15)).toUpperCase();
  const programKey = "bg-payout-ci-" + programId.slice(0, 12);
  const periodKey = now.toISOString().slice(0, 10);

  try {
    await db.insert(assetRegistry).values({
      id: assetId,
      assetCode,
      network: "devnet",
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      mintAddress,
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
      mintAddress,
      treasuryWalletAddress,
      tokenAccountAddress: sourceTokenAccount,
      feePayerAddress,
      signerProvider: "kms",
      signerKeyReference: "kms://ci/brightglobe/bg-test",
      hotWalletCapBaseUnits: 2_000n,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardPrograms).values({
      id: programId,
      assetId,
      programKey,
      actionType: "daily_collection",
      ruleVersion: 1,
      status: "active",
      rewardBaseUnits: amount,
      perUserLimit: 1,
      budgetBaseUnits: 1_000n,
      reservedBaseUnits: amount,
      paidBaseUnits: 0n,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: null,
      approvalReference: "ci-payout-approval",
      approvedBy: "ci-payout-operator",
      approvedAt: now,
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardEvents).values({
      id: eventId,
      programId,
      canonicalUserId,
      actionType: "daily_collection",
      evidenceRef: null,
      idempotencyKey: "bg-payout-repository:" + id,
      amountBaseUnits: amount,
      ruleVersion: 1,
      periodKey,
      status: "reserved",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardPayoutIntents).values({
      id: payoutId,
      rewardEventId: eventId,
      treasuryAccountId,
      network: "devnet",
      mintAddress,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      sourceTokenAccount,
      feePayerAddress,
      treasuryAuthorityAddress: treasuryWalletAddress,
      destinationWallet,
      destinationTokenAccount,
      amountBaseUnits: amount,
      status: "queued",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(bgTreasuryReconciliationSnapshots).values({
      id: createUuidV7(now.getTime()),
      treasuryAccountId,
      network: "devnet",
      mintAddress,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      tokenAccountAddress: sourceTokenAccount,
      accountOwnerAddress: treasuryWalletAddress,
      accountMintAddress: mintAddress,
      accountState: "initialized",
      observedSlot: 123n,
      tokenBalanceBaseUnits: 1_000n,
      reservedBaseUnits: amount,
      paidBaseUnits: 0n,
      availableAfterReservationsBaseUnits: 900n,
      status: "matched",
      discrepancyCode: null,
      evidence: { finalizedAccountRead: true },
      createdAt: new Date(now.getTime() - 10 * 60 * 1000)
    });

    const repository = createDrizzleBgDevnetPayoutRepository(db);
    assert.equal(await repository.claimNextQueued("stale-inventory-worker"), null,
      "a stale reconciliation snapshot must fail closed before signing");
    await db.insert(bgTreasuryReconciliationSnapshots).values({
      id: createUuidV7(now.getTime() + 1),
      treasuryAccountId,
      network: "devnet",
      mintAddress,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      tokenAccountAddress: sourceTokenAccount,
      accountOwnerAddress: treasuryWalletAddress,
      accountMintAddress: mintAddress,
      accountState: "initialized",
      observedSlot: 124n,
      tokenBalanceBaseUnits: 1_000n,
      reservedBaseUnits: amount,
      paidBaseUnits: 0n,
      availableAfterReservationsBaseUnits: 900n,
      status: "matched",
      discrepancyCode: null,
      evidence: { finalizedAccountRead: true },
      createdAt: now
    });
    const concurrentClaims = await Promise.all([
      repository.claimNextQueued("ci-payout-worker"),
      repository.claimNextQueued("second-worker")
    ]);
    const claimed = concurrentClaims.find((candidate) => candidate !== null) ?? null;
    assert.ok(claimed);
    assert.equal(concurrentClaims.filter((candidate) => candidate !== null).length, 1);
    assert.equal(claimed.id, payoutId);
    assert.equal(claimed.signerProvider, "kms");
    assert.equal(claimed.remainingRollingOutflowBaseUnits, 2_000n);
    assert.equal(await repository.claimNextQueued("third-worker"), null);

    assert.equal(await repository.persistSigned({
      payoutIntentId: payoutId,
      signature: "ci-signed-bg-payout-signature",
      recentBlockhash: testAddress(900_007),
      lastValidBlockHeight: 123n
    }), true);

    const concurrentRecoveryClaims = await Promise.all([
      repository.claimReconciliationBatch("ci-reconciler", 10),
      repository.claimReconciliationBatch("second-reconciler", 10)
    ]);
    const signedRecovery = concurrentRecoveryClaims.flat();
    assert.equal(signedRecovery.length, 1);
    assert.equal(signedRecovery[0]?.id, payoutId);
    assert.equal(signedRecovery[0]?.status, "signed");
    assert.equal(signedRecovery[0]?.signature, "ci-signed-bg-payout-signature");
    assert.equal(signedRecovery[0]?.lastValidBlockHeight, 123n);
    assert.equal(await repository.persistSigned({
      payoutIntentId: payoutId,
      signature: "different-signature",
      recentBlockhash: testAddress(900_008),
      lastValidBlockHeight: 124n
    }), false);

    assert.equal(await repository.transition({
      payoutIntentId: payoutId,
      from: "signed",
      to: "submitted",
      signature: "ci-signed-bg-payout-signature",
      evidence: { broadcastAccepted: true }
    }), true);
    assert.equal(await repository.transition({
      payoutIntentId: payoutId,
      from: "submitted",
      to: "reconciliation_required",
      signature: "ci-signed-bg-payout-signature",
      evidence: { broadcastOutcomeAmbiguous: true }
    }), true);

    const ambiguousRecovery = await repository.claimReconciliationBatch("ci-reconciler", 10);
    assert.equal(ambiguousRecovery.length, 1);
    assert.equal(ambiguousRecovery[0]?.status, "reconciliation_required");
    assert.equal(await repository.transition({
      payoutIntentId: payoutId,
      from: "reconciliation_required",
      to: "finalized",
      signature: "ci-signed-bg-payout-signature",
      slot: 456n,
      evidence: { finalizedTransferVerified: true }
    }), true);

    assert.equal(await repository.settleFinalizedPayoutOnce({
      payoutIntentId: payoutId,
      signature: "ci-signed-bg-payout-signature",
      finalizedSlot: 456n
    }), true);
    assert.equal(await repository.settleFinalizedPayoutOnce({
      payoutIntentId: payoutId,
      signature: "ci-signed-bg-payout-signature",
      finalizedSlot: 456n
    }), true);

    const [payout] = await db.select().from(rewardPayoutIntents).where(eq(rewardPayoutIntents.id, payoutId));
    const [event] = await db.select().from(rewardEvents).where(eq(rewardEvents.id, eventId));
    const [program] = await db.select().from(rewardPrograms).where(eq(rewardPrograms.id, programId));
    const [userAccount] = await db.select().from(assetAccounts).where(eq(assetAccounts.canonicalUserId, canonicalUserId));
    assert.equal(payout?.status, "paid");
    assert.equal(event?.status, "paid");
    assert.equal(program?.reservedBaseUnits, 0n);
    assert.equal(program?.paidBaseUnits, amount);
    assert.equal(userAccount?.balanceBaseUnits, amount);

    const postings = await pool.query(
      "SELECT count(*)::int AS count FROM public.asset_ledger_postings p JOIN public.asset_ledger_transactions t ON t.id = p.transaction_id WHERE t.reference_type = 'reward_payout_intent' AND t.reference_id = $1",
      [payoutId]
    );
    assert.equal(postings.rows[0]?.count, 2);

    // A definitive pre-broadcast failure releases the program reservation,
    // while the prior paid payout remains in the rolling outflow window.
    const failedEventId = createUuidV7(now.getTime());
    const failedPayoutId = createUuidV7(now.getTime());
    const nextPeriod = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.update(rewardPrograms)
      .set({ reservedBaseUnits: amount, updatedAt: new Date() })
      .where(eq(rewardPrograms.id, programId));
    await db.insert(rewardEvents).values({
      id: failedEventId,
      programId,
      canonicalUserId,
      actionType: "daily_collection",
      evidenceRef: null,
      idempotencyKey: "bg-payout-repository-failed:" + id,
      amountBaseUnits: amount,
      ruleVersion: 1,
      periodKey: nextPeriod,
      status: "reserved",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardPayoutIntents).values({
      id: failedPayoutId,
      rewardEventId: failedEventId,
      treasuryAccountId,
      network: "devnet",
      mintAddress,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      sourceTokenAccount,
      feePayerAddress,
      treasuryAuthorityAddress: treasuryWalletAddress,
      destinationWallet: testAddress(900_009),
      destinationTokenAccount: testAddress(900_010),
      amountBaseUnits: amount,
      status: "queued",
      createdAt: new Date(now.getTime() + 1),
      updatedAt: now
    });
    const failedClaim = await repository.claimNextQueued("failure-test-worker");
    assert.equal(failedClaim?.id, failedPayoutId);
    assert.equal(await repository.transition({
      payoutIntentId: failedPayoutId,
      from: "signing",
      to: "failed",
      errorCode: "PAYOUT_PREFLIGHT_REJECTED",
      evidence: { notBroadcastVerified: true }
    }), true);
    const [releasedProgram] = await db.select().from(rewardPrograms).where(eq(rewardPrograms.id, programId));
    const [failedEvent] = await db.select().from(rewardEvents).where(eq(rewardEvents.id, failedEventId));
    assert.equal(releasedProgram?.reservedBaseUnits, 0n);
    assert.equal(failedEvent?.status, "failed");

    // The matched snapshot observed 1,000 units before the first 100-unit payout
    // settled. The paid delta reduces the usable observed balance to 900; a new
    // 901-unit reservation must therefore fail closed even though the old
    // snapshot alone appears to have enough inventory.
    const paidDeltaProgramId = createUuidV7(now.getTime() + 9);
    const paidDeltaEventId = createUuidV7(now.getTime() + 10);
    const paidDeltaPayoutId = createUuidV7(now.getTime() + 11);
    await db.insert(rewardPrograms).values({
      id: paidDeltaProgramId,
      assetId,
      programKey: "bg-payout-paid-delta-" + paidDeltaProgramId.slice(0, 12),
      actionType: "campaign",
      ruleVersion: 1,
      status: "active",
      rewardBaseUnits: 901n,
      perUserLimit: 1,
      budgetBaseUnits: 2_000n,
      reservedBaseUnits: 901n,
      paidBaseUnits: 0n,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: null,
      approvalReference: "ci-paid-delta-approval",
      approvedBy: "ci-paid-delta-operator",
      approvedAt: now,
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardEvents).values({
      id: paidDeltaEventId,
      programId: paidDeltaProgramId,
      canonicalUserId,
      actionType: "campaign",
      evidenceRef: null,
      idempotencyKey: "bg-payout-repository-paid-delta:" + id,
      amountBaseUnits: 901n,
      ruleVersion: 1,
      periodKey: null,
      status: "reserved",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(rewardPayoutIntents).values({
      id: paidDeltaPayoutId,
      rewardEventId: paidDeltaEventId,
      treasuryAccountId,
      network: "devnet",
      mintAddress,
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      sourceTokenAccount,
      feePayerAddress,
      treasuryAuthorityAddress: treasuryWalletAddress,
      destinationWallet: testAddress(900_011),
      destinationTokenAccount: testAddress(900_012),
      amountBaseUnits: 901n,
      status: "queued",
      createdAt: new Date(now.getTime() + 2),
      updatedAt: now
    });
    assert.equal(await repository.claimNextQueued("paid-delta-overdraw-worker"), null,
      "paid payouts since the snapshot must reduce the balance available for later claims");
    const [unclaimedPaidDeltaPayout] = await db.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, paidDeltaPayoutId));
    assert.equal(unclaimedPaidDeltaPayout?.status, "queued");

    const createEligibilityProgram = async (
      suffix: string,
      status: "active" | "paused",
      startsAt: Date,
      endsAt: Date | null
    ): Promise<string> => {
      const probeProgramId = createUuidV7(Date.now());
      await db.insert(rewardPrograms).values({
        id: probeProgramId,
        assetId,
        programKey: "bg-payout-probe-" + suffix + "-" + probeProgramId.slice(0, 8),
        actionType: "campaign",
        ruleVersion: 1,
        status,
        rewardBaseUnits: amount,
        perUserLimit: 1,
        budgetBaseUnits: 1_000n,
        reservedBaseUnits: 0n,
        paidBaseUnits: 0n,
        startsAt,
        endsAt,
        approvalReference: status === "active" ? "ci-probe-approval" : null,
        approvedBy: status === "active" ? "ci-probe-operator" : null,
        approvedAt: status === "active" ? now : null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return probeProgramId;
    };

    const queueEligibilityProbe = async (suffix: string, probeProgramId: string): Promise<string> => {
      const probeEventId = createUuidV7(Date.now());
      const probePayoutId = createUuidV7(Date.now());
      await db.insert(rewardEvents).values({
        id: probeEventId,
        programId: probeProgramId,
        canonicalUserId,
        actionType: "campaign",
        evidenceRef: null,
        idempotencyKey: "bg-payout-eligibility:" + suffix + ":" + id,
        amountBaseUnits: amount,
        ruleVersion: 1,
        periodKey: null,
        status: "reserved",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await db.insert(rewardPayoutIntents).values({
        id: probePayoutId,
        rewardEventId: probeEventId,
        treasuryAccountId,
        network: "devnet",
        mintAddress,
        tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
        sourceTokenAccount,
        feePayerAddress,
        treasuryAuthorityAddress: treasuryWalletAddress,
        destinationWallet: testAddress(910_000 + suffix.length),
        destinationTokenAccount: testAddress(920_000 + suffix.length),
        amountBaseUnits: amount,
        status: "queued",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return probePayoutId;
    };

    const pausedProgramId = await createEligibilityProgram(
      "paused", "paused", new Date(now.getTime() - 60_000), null
    );
    const pausedPayoutId = await queueEligibilityProbe("paused", pausedProgramId);
    assert.equal(await repository.claimNextQueued("paused-program-worker"), null);
    const [pausedPayout] = await db.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, pausedPayoutId));
    assert.equal(pausedPayout?.status, "queued", "operator pause must leave queued payout untouched");

    const expiredProgramId = await createEligibilityProgram(
      "expired", "active", new Date(now.getTime() - 60_000), new Date(now.getTime() - 1)
    );
    const expiredPayoutId = await queueEligibilityProbe("expired", expiredProgramId);
    assert.equal(await repository.claimNextQueued("expired-program-worker"), null);
    const [expiredPayout] = await db.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, expiredPayoutId));
    assert.equal(expiredPayout?.status, "queued", "expired program must not start a payout");

    const futureProgramId = await createEligibilityProgram(
      "future", "active", new Date(now.getTime() + 60 * 60 * 1000), null
    );
    const futurePayoutId = await queueEligibilityProbe("future", futureProgramId);
    assert.equal(await repository.claimNextQueued("future-program-worker"), null);
    const [futurePayout] = await db.select().from(rewardPayoutIntents)
      .where(eq(rewardPayoutIntents.id, futurePayoutId));
    assert.equal(futurePayout?.status, "queued", "future program must not start a payout");
  } finally {
    await pool.end();
  }
});
