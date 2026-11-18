import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
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
import { decodeSolanaAddress } from "../blockchain/solana/address.js";
import { SOLANA_DEVNET_GENESIS_HASH, type SolanaPayoutGateway } from "../blockchain/solana/gateway.js";
import { deriveClassicSplAssociatedTokenAddress } from "../blockchain/solana/transfer-builder.js";
import { createUuidV7 } from "../identity/ids.js";
import { processBgDevnetPayoutIntent, reconcileBgDevnetTreasury, type BgDevnetPayoutSigner } from "./bg-devnet-payout-service.js";
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

function encodeBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
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

function writeU64(bytes: Uint8Array, offset: number, amount: bigint): void {
  let value = amount;
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = Number(value & 0xffn);
    value >>= 8n;
  }
}

function createMintAccountData(decimals: number): string {
  const bytes = new Uint8Array(82);
  writeU64(bytes, 36, 1_000_000_000_000n);
  bytes[44] = decimals;
  bytes[45] = 1;
  return Buffer.from(bytes).toString("base64");
}

function createTokenAccountData(mintAddress: string, ownerAddress: string, amount: bigint): string {
  const mint = decodeSolanaAddress(mintAddress);
  const owner = decodeSolanaAddress(ownerAddress);
  if (!mint || !owner) throw new Error("Invalid test token account address.");
  const bytes = new Uint8Array(165);
  bytes.set(mint, 0);
  bytes.set(owner, 32);
  writeU64(bytes, 64, amount);
  bytes[108] = 1;
  return Buffer.from(bytes).toString("base64");
}

async function createTestEd25519Keypair(): Promise<{ address: string; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { address: encodeBase58(publicKey), privateKey: pair.privateKey };
}

function readTransactionSignatureVector(bytes: Uint8Array): { count: number; next: number } {
  let value = 0;
  let shift = 0;
  let offset = 0;
  for (let index = 0; index < 3; index += 1) {
    const byte = bytes[offset++]!;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { count: value, next: offset };
    shift += 7;
  }
  throw new Error("Invalid test transaction signature vector.");
}

test("BG daily reservation is atomic, budget-safe and idempotent in PostgreSQL", {
  skip: !connectionString ? "LOCAL_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async (t) => {
  const pool = new PgPool({ connectionString });
  const db = drizzle(pool, { schema }) as unknown as Database;
  const now = new Date("2026-11-17T12:00:00.000Z");
  let assetId = createUuidV7(now.getTime());
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
  // Migration 0008 seeds the BG/devnet placeholder. Reuse that row in
  // this isolated test database instead of violating its unique asset key.
  const [seededAsset] = await db.select().from(assetRegistry).where(and(
    eq(assetRegistry.assetCode, "BG"),
    eq(assetRegistry.network, "devnet")
  )).limit(1);
  if (seededAsset) {
    assetId = seededAsset.id;
    await db.update(assetRegistry).set({
      tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      mintAddress,
      decimals: 9,
      status: "active",
      metadataSource: "verified",
      updatedAt: now
    }).where(eq(assetRegistry.id, assetId));
  } else {
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
  }
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

    await t.test("Devnet payout persists its signature before broadcast and settles only an exact finalized transfer", async () => {
      const feePayerKey = await createTestEd25519Keypair();
      const treasuryKey = await createTestEd25519Keypair();
      const sourceAta = await deriveClassicSplAssociatedTokenAddress({
        ownerAddress: treasuryKey.address,
        mintAddress
      });
      const signerKeyReference = "ci-devnet-payout-test-key";
      await db.update(treasuryAccounts).set({
        treasuryWalletAddress: treasuryKey.address,
        tokenAccountAddress: sourceAta,
        feePayerAddress: feePayerKey.address,
        signerProvider: "devnet_local",
        signerKeyReference,
        hotWalletCapBaseUnits: 10_000_000_000_000n,
        status: "active",
        updatedAt: now
      }).where(eq(treasuryAccounts.id, treasuryAccountId));

      const keyByAddress = new Map([
        [feePayerKey.address, feePayerKey.privateKey],
        [treasuryKey.address, treasuryKey.privateKey]
      ]);
      const destinationMintData = createMintAccountData(9);

      function makeHarness(
        destinationWallet: string,
        amountOnChain: bigint,
        options: { finalizedError?: boolean; transferAmount?: bigint; throwAfterAccept?: boolean } = {}
      ) {
        let signature = "";
        let submitted = false;
        let sendCount = 0;
        let threwAfterAccept = false;
        let destinationAta = "";
        const gateway: SolanaPayoutGateway = {
          async getDevnetStatus() {
            return { healthy: true, genesisHash: SOLANA_DEVNET_GENESIS_HASH, slot: 501, blockHeight: 100 };
          },
          async getAccountInfo(address) {
            if (address === mintAddress) {
              return {
                contextSlot: 501,
                account: {
                  data: [destinationMintData, "base64"],
                  executable: false,
                  lamports: 1,
                  owner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
                  rentEpoch: 0
                }
              };
            }
            if (address === sourceAta) {
              return {
                contextSlot: 501,
                account: {
                  data: [createTokenAccountData(mintAddress, treasuryKey.address, amountOnChain), "base64"],
                  executable: false,
                  lamports: 2_039_280,
                  owner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
                  rentEpoch: 0
                }
              };
            }
            if (address === feePayerKey.address) {
              return {
                contextSlot: 501,
                account: {
                  data: ["AA==", "base64"],
                  executable: false,
                  lamports: 10_000_000,
                  owner: "11111111111111111111111111111111",
                  rentEpoch: 0
                }
              };
            }
            if (address === destinationAta && submitted) {
              return {
                contextSlot: 501,
                account: {
                  data: [createTokenAccountData(mintAddress, destinationWallet, options.transferAmount ?? 100n), "base64"],
                  executable: false,
                  lamports: 2_039_280,
                  owner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
                  rentEpoch: 0
                }
              };
            }
            return { contextSlot: 501, account: null };
          },
          async getLatestBlockhash() {
            return { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1_000, contextSlot: 501 };
          },
          async getBlockHeight() {
            return 100;
          },
          async getTransaction(txSignature) {
            if (!submitted || options.finalizedError) return null;
            return {
              slot: 501,
              meta: { err: null, innerInstructions: [] },
              transaction: {
                signatures: [txSignature],
                message: {
                  recentBlockhash: "11111111111111111111111111111111",
                  instructions: [{
                    programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
                    parsed: {
                      type: "transferChecked",
                      info: {
                        source: sourceAta,
                        destination: destinationAta,
                        authority: treasuryKey.address,
                        mint: mintAddress,
                        tokenAmount: { amount: (options.transferAmount ?? 100n).toString() }
                      }
                    }
                  }]
                }
              }
            };
          },
          async getTokenAccountsByOwner() {
            return [];
          },
          async getSignaturesForAddress() {
            return [];
          },
          async getSignatureStatuses(signatures) {
            return {
              context: { slot: 501 },
              value: signatures.map(() => submitted ? {
                slot: 501,
                confirmations: null,
                err: options.finalizedError ? { InstructionError: [0, "Custom"] } : null,
                confirmationStatus: "finalized" as const
              } : null)
            };
          },
          async simulateTransaction() {
            return { err: null, logs: [], unitsConsumed: 120_000, contextSlot: 501 };
          },
          async sendTransaction() {
            sendCount += 1;
            if (!signature) throw new Error("Test signer did not provide a signature.");
            submitted = true;
            if (options.throwAfterAccept && !threwAfterAccept) {
              threwAfterAccept = true;
              throw new Error("Simulated RPC timeout after acceptance.");
            }
            return signature;
          }
        };
        const signer: BgDevnetPayoutSigner = {
          provider: "devnet_local",
          keyReference: signerKeyReference,
          async signTransaction(input) {
            const unsigned = new Uint8Array(Buffer.from(input.unsignedTransactionBase64, "base64"));
            const vector = readTransactionSignatureVector(unsigned);
            const messageOffset = vector.next + vector.count * 64;
            const message = unsigned.slice(messageOffset);
            const signatures = await Promise.all(input.requiredSigners.map(async (address) => {
              const privateKey = keyByAddress.get(address);
              if (!privateKey) throw new Error("Test signer key is not configured.");
              return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, privateKey, message));
            }));
            const signed = new Uint8Array(1 + signatures.length * 64 + message.length);
            signed[0] = signatures.length;
            let offset = 1;
            for (const item of signatures) {
              signed.set(item, offset);
              offset += item.length;
            }
            signed.set(message, offset);
            signature = encodeBase58(signed.slice(1, 65));
            return { signedTransactionBase64: Buffer.from(signed).toString("base64") };
          }
        };
        return {
          gateway,
          signer,
          setDestinationAta(value: string) { destinationAta = value; },
          get sendCount() { return sendCount; }
        };
      }

      const programId = await createActiveProgram(8, 100n, 1_000n);
      const userId = await addUser();
      const [wallet] = await db.select().from(walletOwnerships)
        .where(eq(walletOwnerships.canonicalUserId, userId))
        .limit(1);
      assert.ok(wallet);
      const reservation = await reserveBgDailyReward(db, { canonicalUserId: userId, now }, allowRisk);
      const [payoutBefore] = await db.select().from(rewardPayoutIntents)
        .where(eq(rewardPayoutIntents.id, reservation.payoutIntentId));
      assert.equal(payoutBefore?.status, "queued");
      const harness = makeHarness(wallet.address, 1_000_000_000_000n, { throwAfterAccept: true });
      harness.setDestinationAta(await deriveClassicSplAssociatedTokenAddress({
        ownerAddress: wallet.address,
        mintAddress
      }));

      const concurrent = await Promise.all([
        processBgDevnetPayoutIntent(db, harness.gateway, harness.signer, {
          payoutIntentId: reservation.payoutIntentId,
          now: new Date(now.getTime() + 1_000),
          allowTestSigner: true
        }),
        processBgDevnetPayoutIntent(db, harness.gateway, harness.signer, {
          payoutIntentId: reservation.payoutIntentId,
          now: new Date(now.getTime() + 1_000),
          allowTestSigner: true
        })
      ]);
      assert.equal(concurrent.filter((item) => item.status === "submitted").length, 1);
      assert.equal(concurrent.filter((item) => item.status === "busy").length, 1);
      assert.equal(harness.sendCount, 1);
      const [signedPayout] = await db.select().from(rewardPayoutIntents)
        .where(eq(rewardPayoutIntents.id, reservation.payoutIntentId));
      assert.equal(signedPayout?.status, "submitted");
      assert.ok(signedPayout?.chainSignature);
      assert.equal(signedPayout?.recentBlockhash, "11111111111111111111111111111111");
      assert.equal(signedPayout?.lastValidBlockHeight, 1_000n);

      const paid = await processBgDevnetPayoutIntent(db, harness.gateway, harness.signer, {
        payoutIntentId: reservation.payoutIntentId,
        now: new Date(now.getTime() + 60_000),
        allowTestSigner: true
      });
      assert.equal(paid.status, "paid");
      const replay = await processBgDevnetPayoutIntent(db, harness.gateway, harness.signer, {
        payoutIntentId: reservation.payoutIntentId,
        now: new Date(now.getTime() + 120_000),
        allowTestSigner: true
      });
      assert.equal(replay.status, "paid");
      assert.equal(harness.sendCount, 1);
      const [paidEvent] = await db.select().from(rewardEvents)
        .where(eq(rewardEvents.id, reservation.rewardEventId));
      const [paidProgram] = await db.select().from(rewardPrograms)
        .where(eq(rewardPrograms.id, programId));
      assert.equal(paidEvent?.status, "paid");
      assert.equal(paidProgram?.reservedBaseUnits, 0n);
      assert.equal(paidProgram?.paidBaseUnits, 100n);

      const failedProgramId = await createActiveProgram(9, 100n, 1_000n);
      const failedUser = await addUser();
      const failedReservation = await reserveBgDailyReward(db, { canonicalUserId: failedUser, now }, allowRisk);
      const [failedWallet] = await db.select().from(walletOwnerships)
        .where(eq(walletOwnerships.canonicalUserId, failedUser))
        .limit(1);
      assert.ok(failedWallet);
      const failedHarness = makeHarness(failedWallet.address, 1_000_000_000_000n, { finalizedError: true });
      failedHarness.setDestinationAta(await deriveClassicSplAssociatedTokenAddress({
        ownerAddress: failedWallet.address,
        mintAddress
      }));
      const failedSubmit = await processBgDevnetPayoutIntent(db, failedHarness.gateway, failedHarness.signer, {
        payoutIntentId: failedReservation.payoutIntentId,
        now: new Date(now.getTime() + 180_000),
        allowTestSigner: true
      });
      assert.equal(failedSubmit.status, "submitted");
      const failed = await processBgDevnetPayoutIntent(db, failedHarness.gateway, failedHarness.signer, {
        payoutIntentId: failedReservation.payoutIntentId,
        now: new Date(now.getTime() + 240_000),
        allowTestSigner: true
      });
      assert.equal(failed.status, "failed");
      const [failedEvent] = await db.select().from(rewardEvents)
        .where(eq(rewardEvents.id, failedReservation.rewardEventId));
      const [failedProgram] = await db.select().from(rewardPrograms)
        .where(eq(rewardPrograms.id, failedProgramId));
      assert.equal(failedEvent?.status, "failed");
      assert.equal(failedProgram?.reservedBaseUnits, 0n);
      assert.equal(failedProgram?.paidBaseUnits, 0n);

      const mismatchProgramId = await createActiveProgram(10, 100n, 1_000n);
      const mismatchUser = await addUser();
      const mismatchReservation = await reserveBgDailyReward(db, { canonicalUserId: mismatchUser, now }, allowRisk);
      const [mismatchWallet] = await db.select().from(walletOwnerships)
        .where(eq(walletOwnerships.canonicalUserId, mismatchUser))
        .limit(1);
      assert.ok(mismatchWallet);
      const mismatchHarness = makeHarness(mismatchWallet.address, 1_000_000_000_000n, { transferAmount: 99n });
      mismatchHarness.setDestinationAta(await deriveClassicSplAssociatedTokenAddress({
        ownerAddress: mismatchWallet.address,
        mintAddress
      }));
      await processBgDevnetPayoutIntent(db, mismatchHarness.gateway, mismatchHarness.signer, {
        payoutIntentId: mismatchReservation.payoutIntentId,
        now: new Date(now.getTime() + 300_000),
        allowTestSigner: true
      });
      const mismatch = await processBgDevnetPayoutIntent(db, mismatchHarness.gateway, mismatchHarness.signer, {
        payoutIntentId: mismatchReservation.payoutIntentId,
        now: new Date(now.getTime() + 360_000),
        allowTestSigner: true
      });
      assert.equal(mismatch.status, "quarantined");
      const [mismatchEvent] = await db.select().from(rewardEvents)
        .where(eq(rewardEvents.id, mismatchReservation.rewardEventId));
      const [mismatchProgram] = await db.select().from(rewardPrograms)
        .where(eq(rewardPrograms.id, mismatchProgramId));
      assert.equal(mismatchEvent?.status, "quarantined");
      assert.equal(mismatchProgram?.reservedBaseUnits, 100n);
      await assert.rejects(
        () => pool.query("UPDATE public.reward_payout_intents SET status = 'paid' WHERE id = $1", [mismatchReservation.payoutIntentId]),
        /Invalid BG reward payout state transition/
      );

      const healthyReconciliation = await reconcileBgDevnetTreasury(db, makeHarness(wallet.address, 1_000_000_000_000n).gateway, {
        treasuryAccountId,
        now: new Date(now.getTime() + 420_000)
      });
      assert.equal(healthyReconciliation.status, "healthy");
      assert.equal(BigInt(healthyReconciliation.reservedLiabilityBaseUnits) >= 100n, true);
      await assert.rejects(
        () => pool.query(
          "UPDATE public.bg_treasury_reconciliation_runs SET status = 'underfunded' WHERE id = $1",
          [healthyReconciliation.runId]
        ),
        /append-only/
      );

      const underfundedReconciliation = await reconcileBgDevnetTreasury(db, makeHarness(wallet.address, 1n).gateway, {
        treasuryAccountId,
        now: new Date(now.getTime() + 480_000)
      });
      assert.equal(underfundedReconciliation.status, "underfunded");
    });

  } finally {
    await pool.end();
  }
});
