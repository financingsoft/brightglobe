import assert from "node:assert/strict";
import test from "node:test";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  canonicalUsers,
  rewardEvents,
  rewardPayoutIntents,
  rewardPrograms,
  schema,
  treasuryAccounts,
  walletOwnerships
} from "../db/schema.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { deriveClassicSplAssociatedTokenAddress } from "../blockchain/solana/transfer-builder.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  BG_DAILY_COLLECTION_PROGRAM_KEY,
  BgRewardReservationError,
  reserveBgDailyReward
} from "./bg-reward-engine.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;
const allowRisk = async () => ({ allowed: true, reference: "ci-daily-risk-approval" });
const denyRisk = async () => ({ allowed: false, reference: "ci-daily-risk-denial" });

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

test("BG daily reservation is atomic, budget-safe and idempotent in PostgreSQL", {
  skip: !connectionString ? "LOCAL_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async (t) => {
  const pool = new PgPool({ connectionString });
  const db = drizzle(pool, { schema }) as unknown as Database;
  const now = new Date("2026-11-17T12:00:00.000Z");
  const assetId = createUuidV7(now.getTime());
  const mintAddress = testAddress(9001);
  const treasuryWalletAddress = testAddress(9002);
  const feePayerAddress = testAddress(9003);
  const sourceTokenAccount = await deriveClassicSplAssociatedTokenAddress({
    ownerAddress: treasuryWalletAddress,
    mintAddress
  });

  async function addUser(walletCount = 1, status = "active"): Promise<string> {
    const canonicalUserId = createUuidV7(now.getTime());
    await db.insert(canonicalUsers).values({
      id: canonicalUserId,
      status,
      createdAt: now,
      updatedAt: now
    });
    for (let index = 0; index < walletCount; index += 1) {
      await db.insert(walletOwnerships).values({
        id: createUuidV7(now.getTime()),
        canonicalUserId,
        network: "devnet",
        address: testAddress(10_000 + walletSequence++),
        verifiedAt: now,
        createdAt: now
      });
    }
    return canonicalUserId;
  }

  let walletSequence = 0;
  await db.insert(assetRegistry).values({
    id: assetId,
    assetCode: "BG",
    network: "devnet",
    tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
    mintAddress,
    decimals: 9,
    status: "active",
    metadataSource: "verified",
    createdAt: now,
    updatedAt: now
  });
  const treasuryAccountId = createUuidV7(now.getTime());
  await db.insert(treasuryAccounts).values({
    id: treasuryAccountId,
    assetId,
    network: "devnet",
    mintAddress,
    treasuryWalletAddress,
    tokenAccountAddress: sourceTokenAccount,
    feePayerAddress,
    signerProvider: "devnet_local",
    signerKeyReference: "ci-devnet-test-key-reference",
    hotWalletCapBaseUnits: 1_000_000_000n,
    status: "active",
    createdAt: now,
    updatedAt: now
  });

  async function createActiveProgram(version: number, reward: bigint, budget: bigint): Promise<string> {
    await db.update(rewardPrograms)
      .set({ status: "retired", updatedAt: now })
      .where(and(
        eq(rewardPrograms.assetId, assetId),
        eq(rewardPrograms.programKey, BG_DAILY_COLLECTION_PROGRAM_KEY),
        eq(rewardPrograms.status, "active")
      ));
    const id = createUuidV7(now.getTime());
    await db.insert(rewardPrograms).values({
      id,
      assetId,
      programKey: BG_DAILY_COLLECTION_PROGRAM_KEY,
      actionType: "daily_collection",
      ruleVersion: version,
      status: "active",
      rewardBaseUnits: reward,
      perUserLimit: 1,
      budgetBaseUnits: budget,
      reservedBaseUnits: 0n,
      paidBaseUnits: 0n,
      startsAt: new Date("2026-11-01T00:00:00.000Z"),
      endsAt: null,
      approvalReference: "ci-test-approval-reference",
      approvedBy: "ci-test-operator",
      approvedAt: now,
      createdAt: now,
      updatedAt: now
    });
    return id;
  }

  try {
    await pool.query("SELECT 1 FROM public.reward_programs LIMIT 0");
    await pool.query("SELECT 1 FROM public.wallet_ownerships LIMIT 0");

    await t.test("duplicate request returns the same event and payout without reserving twice", async () => {
      const programId = await createActiveProgram(1, 100n, 1_000n);
      const userId = await addUser();
      const first = await reserveBgDailyReward(db, { canonicalUserId: userId, now }, allowRisk);
      const replay = await reserveBgDailyReward(db, { canonicalUserId: userId, now }, allowRisk);
      assert.equal(first.outcome, "reserved");
      assert.equal(replay.outcome, "replayed");
      assert.equal(replay.rewardEventId, first.rewardEventId);
      assert.equal(replay.payoutIntentId, first.payoutIntentId);
      assert.equal(first.periodKey, "2026-11-17");

      const [program] = await db.select().from(rewardPrograms).where(eq(rewardPrograms.id, programId));
      assert.equal(program?.reservedBaseUnits, 100n);
      const events = await db.select().from(rewardEvents).where(eq(rewardEvents.programId, programId));
      const payouts = await db.select().from(rewardPayoutIntents)
        .where(eq(rewardPayoutIntents.rewardEventId, first.rewardEventId));
      assert.equal(events.length, 1);
      assert.equal(payouts.length, 1);
      assert.equal(payouts[0]?.treasuryAccountId, treasuryAccountId);
      assert.equal(payouts[0]?.tokenProgram, CLASSIC_SPL_TOKEN_PROGRAM_ID);
      assert.equal(payouts[0]?.feePayerAddress, feePayerAddress);
      assert.equal(payouts[0]?.recentBlockhash, null);
      assert.equal(payouts[0]?.lastValidBlockHeight, null);
      await assert.rejects(
        () => pool.query(
          "UPDATE public.reward_payout_intents SET destination_wallet = $1 WHERE id = $2",
          [testAddress(99_999), first.payoutIntentId]
        ),
        /immutable/
      );
      await assert.rejects(
        () => pool.query("DELETE FROM public.reward_payout_intents WHERE id = $1", [first.payoutIntentId]),
        /instead of deleting/
      );
      await assert.rejects(
        () => pool.query(
          "UPDATE public.reward_events SET amount_base_units = 999 WHERE id = $1",
          [first.rewardEventId]
        ),
        /immutable/
      );
      await assert.rejects(
        () => pool.query("DELETE FROM public.reward_events WHERE id = $1", [first.rewardEventId]),
        /immutable/
      );
      await assert.rejects(
        () => pool.query("DELETE FROM public.reward_programs WHERE id = $1", [programId]),
        /retire instead of deleting/
      );
    });

    await t.test("daily uniqueness survives a new rule version on the same UTC day", async () => {
      const userId = await addUser();
      const oldProgramId = await createActiveProgram(2, 100n, 1_000n);
      const first = await reserveBgDailyReward(db, { canonicalUserId: userId, now }, allowRisk);
      assert.equal(first.programId, oldProgramId);

      const newProgramId = await createActiveProgram(3, 200n, 2_000n);
      const replay = await reserveBgDailyReward(db, { canonicalUserId: userId, now }, allowRisk);
      assert.equal(replay.outcome, "replayed");
      assert.equal(replay.rewardEventId, first.rewardEventId);
      assert.equal(replay.programId, oldProgramId);
      const [newProgram] = await db.select().from(rewardPrograms).where(eq(rewardPrograms.id, newProgramId));
      assert.equal(newProgram?.reservedBaseUnits, 0n);
    });

    await t.test("concurrent requests for one user create exactly one event and payout", async () => {
      const programId = await createActiveProgram(4, 100n, 1_000n);
      const userId = await addUser();
      const outcomes = await Promise.all([
        reserveBgDailyReward(db, { canonicalUserId: userId, now }, allowRisk),
        reserveBgDailyReward(db, { canonicalUserId: userId, now }, allowRisk)
      ]);
      assert.equal(outcomes.filter((item) => item.outcome === "reserved").length, 1);
      assert.equal(outcomes.filter((item) => item.outcome === "replayed").length, 1);
      const [program] = await db.select().from(rewardPrograms).where(eq(rewardPrograms.id, programId));
      assert.equal(program?.reservedBaseUnits, 100n);
    });

    await t.test("concurrent users cannot reserve beyond the global program budget", async () => {
      const programId = await createActiveProgram(5, 100n, 100n);
      const firstUser = await addUser();
      const secondUser = await addUser();
      const outcomes = await Promise.allSettled([
        reserveBgDailyReward(db, { canonicalUserId: firstUser, now }, allowRisk),
        reserveBgDailyReward(db, { canonicalUserId: secondUser, now }, allowRisk)
      ]);
      assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
      const rejected = outcomes.find((item) => item.status === "rejected");
      assert.ok(rejected && rejected.status === "rejected");
      assert.ok(
        rejected.reason instanceof BgRewardReservationError &&
        rejected.reason.code === "BG_REWARD_BUDGET_EXHAUSTED"
      );
      const [program] = await db.select().from(rewardPrograms).where(eq(rewardPrograms.id, programId));
      assert.equal(program?.reservedBaseUnits, 100n);
      const events = await db.select().from(rewardEvents).where(eq(rewardEvents.programId, programId));
      const payouts = await db.select().from(rewardPayoutIntents)
        .where(eq(rewardPayoutIntents.rewardEventId, events[0]!.id));
      assert.equal(events.length, 1);
      assert.equal(payouts.length, 1);
    });

    await t.test("missing or ambiguous verified wallets do not consume budget", async () => {
      const programId = await createActiveProgram(6, 100n, 1_000n);
      const noWalletUser = await addUser(0);
      await assert.rejects(
        () => reserveBgDailyReward(db, { canonicalUserId: noWalletUser, now }, allowRisk),
        (error: unknown) => error instanceof BgRewardReservationError && error.code === "BG_WALLET_REQUIRED"
      );

      const suspendedUser = await addUser(1, "suspended");
      await assert.rejects(
        () => reserveBgDailyReward(db, { canonicalUserId: suspendedUser, now }, allowRisk),
        (error: unknown) => error instanceof BgRewardReservationError && error.code === "CANONICAL_USER_INELIGIBLE"
      );

      const ambiguousUser = await addUser(2);
      await assert.rejects(
        () => reserveBgDailyReward(db, { canonicalUserId: ambiguousUser, now }, allowRisk),
        (error: unknown) => error instanceof BgRewardReservationError && error.code === "BG_WALLET_SELECTION_REQUIRED"
      );

      const riskRejectedUser = await addUser();
      await assert.rejects(
        () => reserveBgDailyReward(db, { canonicalUserId: riskRejectedUser, now }, denyRisk),
        (error: unknown) => error instanceof BgRewardReservationError && error.code === "BG_REWARD_RISK_REJECTED"
      );

      const [program] = await db.select().from(rewardPrograms).where(eq(rewardPrograms.id, programId));
      assert.equal(program?.reservedBaseUnits, 0n);
    });

    await t.test("active rule version cannot be edited in place", async () => {
      const programId = await createActiveProgram(7, 100n, 1_000n);
      await assert.rejects(
        () => pool.query(
          "UPDATE public.reward_programs SET reward_base_units = 200 WHERE id = $1",
          [programId]
        ),
        /immutable/
      );
      await assert.rejects(
        () => pool.query(
          "UPDATE public.reward_programs SET status = 'draft' WHERE id = $1",
          [programId]
        ),
        /immutable/
      );
    });
  } finally {
    await pool.end();
  }
});
