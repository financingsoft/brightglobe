import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  canonicalUsers,
  rewardAuditEvents,
  rewardEvents,
  rewardPayoutIntents,
  rewardPrograms,
  treasuryAccounts,
  walletOwnerships
} from "../db/schema.js";
import { isValidSolanaAddress } from "../blockchain/solana/address.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { deriveClassicSplAssociatedTokenAddress } from "../blockchain/solana/transfer-builder.js";
import { createUuidV7, isUuidV7 } from "../identity/ids.js";

export const BG_DAILY_COLLECTION_PROGRAM_KEY = "bg-daily-collection";
export const BG_DAILY_COLLECTION_ACTION = "daily_collection";
export const BG_REWARD_NETWORK = "devnet";
const SPL_U64_MAX = 18_446_744_073_709_551_615n;

export type BgRewardReservationErrorCode =
  | "CANONICAL_USER_INVALID"
  | "CANONICAL_USER_INELIGIBLE"
  | "BG_REWARD_NOT_CONFIGURED"
  | "BG_REWARD_NOT_AVAILABLE"
  | "BG_REWARD_RULE_INVALID"
  | "BG_REWARD_BUDGET_EXHAUSTED"
  | "BG_ASSET_NOT_CONFIGURED"
  | "BG_TREASURY_NOT_CONFIGURED"
  | "BG_WALLET_REQUIRED"
  | "BG_WALLET_SELECTION_REQUIRED"
  | "BG_REWARD_RULE_CHANGED"
  | "BG_REWARD_INTEGRITY_ERROR";

export class BgRewardReservationError extends Error {
  constructor(
    readonly code: BgRewardReservationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "BgRewardReservationError";
  }
}

export interface BgDailyRewardReservation {
  outcome: "reserved" | "replayed";
  rewardEventId: string;
  payoutIntentId: string;
  programId: string;
  ruleVersion: number;
  periodKey: string;
  amountBaseUnits: string;
  rewardStatus: string;
  payoutStatus: string;
  network: typeof BG_REWARD_NETWORK;
  mintAddress: string;
  destinationWallet: string;
  destinationTokenAccount: string;
}

export function getBgDailyPeriodKey(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid server timestamp is required.");
  }
  return now.toISOString().slice(0, 10);
}

export function getBgDailyIdempotencyKey(canonicalUserId: string, periodKey: string): string {
  if (!isUuidV7(canonicalUserId)) {
    throw new TypeError("A canonical BrightGlobe UUIDv7 user ID is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
    throw new TypeError("The BG daily period must use YYYY-MM-DD.");
  }
  const parsed = new Date(`${periodKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== periodKey) {
    throw new TypeError("The BG daily period must be a valid UTC calendar date.");
  }
  return `bg-daily-collection:${canonicalUserId}:${periodKey}`;
}

/**
 * Reserve one Devnet BG daily reward. Identity, period, amount, rule version,
 * asset, treasury and destination are all derived from server-side state.
 *
 * The database transaction atomically creates the reward event and payout
 * intent while reserving the approved program budget. It does not sign or
 * broadcast a Solana transaction.
 */
export async function reserveBgDailyReward(
  db: Database,
  input: { canonicalUserId: string; now?: Date }
): Promise<BgDailyRewardReservation> {
  const now = input.now ?? new Date();
  const periodKey = getBgDailyPeriodKey(now);
  if (!isUuidV7(input.canonicalUserId)) {
    throw new BgRewardReservationError(
      "CANONICAL_USER_INVALID",
      "A canonical BrightGlobe UUIDv7 user ID is required."
    );
  }
  const idempotencyKey = getBgDailyIdempotencyKey(input.canonicalUserId, periodKey);

  return db.transaction(async (transaction) => {
    const findExisting = async () => {
      const [event] = await transaction.select().from(rewardEvents)
        .where(or(
          eq(rewardEvents.idempotencyKey, idempotencyKey),
          and(
            eq(rewardEvents.canonicalUserId, input.canonicalUserId),
            eq(rewardEvents.actionType, BG_DAILY_COLLECTION_ACTION),
            eq(rewardEvents.periodKey, periodKey)
          )
        ))
        .limit(1);
      if (!event) return null;

      const [payout] = await transaction.select().from(rewardPayoutIntents)
        .where(eq(rewardPayoutIntents.rewardEventId, event.id))
        .limit(1);
      if (!payout) {
        throw new BgRewardReservationError(
          "BG_REWARD_INTEGRITY_ERROR",
          "An existing BG reward event has no atomic payout intent."
        );
      }
      return {
        outcome: "replayed" as const,
        rewardEventId: event.id,
        payoutIntentId: payout.id,
        programId: event.programId,
        ruleVersion: event.ruleVersion,
        periodKey: event.periodKey ?? periodKey,
        amountBaseUnits: event.amountBaseUnits.toString(),
        rewardStatus: event.status,
        payoutStatus: payout.status,
        network: BG_REWARD_NETWORK as typeof BG_REWARD_NETWORK,
        mintAddress: payout.mintAddress,
        destinationWallet: payout.destinationWallet,
        destinationTokenAccount: payout.destinationTokenAccount
      };
    };

    const existing = await findExisting();
    if (existing) return existing;

    const [canonicalUser] = await transaction.select({
      id: canonicalUsers.id,
      status: canonicalUsers.status
    }).from(canonicalUsers)
      .where(eq(canonicalUsers.id, input.canonicalUserId))
      .limit(1)
      .for("share");
    if (!canonicalUser || canonicalUser.status !== "active") {
      throw new BgRewardReservationError(
        "CANONICAL_USER_INELIGIBLE",
        "Only an active canonical BrightGlobe account can reserve BG rewards."
      );
    }

    const [configuration] = await transaction.select({
      program: rewardPrograms,
      asset: assetRegistry
    }).from(rewardPrograms)
      .innerJoin(assetRegistry, eq(rewardPrograms.assetId, assetRegistry.id))
      .where(and(
        eq(rewardPrograms.programKey, BG_DAILY_COLLECTION_PROGRAM_KEY),
        eq(rewardPrograms.actionType, BG_DAILY_COLLECTION_ACTION),
        eq(rewardPrograms.status, "active"),
        eq(assetRegistry.assetCode, "BG"),
        eq(assetRegistry.network, BG_REWARD_NETWORK)
      ))
      .orderBy(desc(rewardPrograms.ruleVersion))
      .limit(1);

    if (!configuration) {
      throw new BgRewardReservationError(
        "BG_REWARD_NOT_CONFIGURED",
        "No approved Devnet BG daily reward program is active."
      );
    }

    const { program, asset: candidateAsset } = configuration;
    const [asset] = await transaction.select().from(assetRegistry)
      .where(eq(assetRegistry.id, candidateAsset.id))
      .limit(1)
      .for("share");
    if (!asset) {
      throw new BgRewardReservationError(
        "BG_ASSET_NOT_CONFIGURED",
        "The configured BG Devnet asset is unavailable."
      );
    }
    if (
      program.startsAt > now ||
      (program.endsAt !== null && program.endsAt <= now)
    ) {
      throw new BgRewardReservationError(
        "BG_REWARD_NOT_AVAILABLE",
        "The active BG daily reward program is outside its approved time window."
      );
    }
    if (
      program.perUserLimit !== 1 ||
      program.approvedBy === null ||
      program.approvedAt === null ||
      program.rewardBaseUnits <= 0n ||
      program.rewardBaseUnits > SPL_U64_MAX
    ) {
      throw new BgRewardReservationError(
        "BG_REWARD_RULE_INVALID",
        "The active BG daily reward rule is not valid for a one-per-day SPL payout."
      );
    }

    if (
      asset.status !== "active" ||
      asset.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
      !asset.mintAddress ||
      asset.decimals === null ||
      !Number.isInteger(asset.decimals) ||
      asset.decimals < 0 ||
      asset.decimals > 18 ||
      !isValidSolanaAddress(asset.mintAddress)
    ) {
      throw new BgRewardReservationError(
        "BG_ASSET_NOT_CONFIGURED",
        "The BG Devnet Classic SPL asset is not fully configured."
      );
    }

    const [treasury] = await transaction.select().from(treasuryAccounts)
      .where(and(
        eq(treasuryAccounts.assetId, asset.id),
        eq(treasuryAccounts.network, BG_REWARD_NETWORK),
        eq(treasuryAccounts.status, "active")
      ))
      .limit(1)
      .for("share");
    if (
      !treasury ||
      treasury.mintAddress !== asset.mintAddress ||
      !treasury.treasuryWalletAddress ||
      !treasury.tokenAccountAddress ||
      !treasury.feePayerAddress ||
      treasury.signerProvider === "unconfigured" ||
      !treasury.signerKeyReference ||
      treasury.hotWalletCapBaseUnits < program.rewardBaseUnits ||
      !isValidSolanaAddress(treasury.treasuryWalletAddress) ||
      !isValidSolanaAddress(treasury.tokenAccountAddress) ||
      !isValidSolanaAddress(treasury.feePayerAddress)
    ) {
      throw new BgRewardReservationError(
        "BG_TREASURY_NOT_CONFIGURED",
        "The capped Devnet BG reward treasury is not fully configured."
      );
    }

    const sourceAta = await deriveClassicSplAssociatedTokenAddress({
      ownerAddress: treasury.treasuryWalletAddress,
      mintAddress: asset.mintAddress
    });
    if (sourceAta !== treasury.tokenAccountAddress) {
      throw new BgRewardReservationError(
        "BG_TREASURY_NOT_CONFIGURED",
        "The configured treasury token account is not the canonical Classic SPL ATA."
      );
    }

    const wallets = await transaction.select().from(walletOwnerships)
      .where(and(
        eq(walletOwnerships.canonicalUserId, input.canonicalUserId),
        eq(walletOwnerships.network, BG_REWARD_NETWORK),
        lte(walletOwnerships.verifiedAt, now)
      ))
      .orderBy(desc(walletOwnerships.createdAt), desc(walletOwnerships.id))
      .limit(2)
      .for("share");
    if (wallets.length === 0) {
      throw new BgRewardReservationError(
        "BG_WALLET_REQUIRED",
        "A verified Solana Devnet recipient wallet is required before a BG reward can be reserved."
      );
    }
    if (wallets.length > 1) {
      throw new BgRewardReservationError(
        "BG_WALLET_SELECTION_REQUIRED",
        "Select one verified Devnet recipient wallet before requesting a BG reward."
      );
    }

    const wallet = wallets[0]!;
    if (
      !isValidSolanaAddress(wallet.address) ||
      wallet.address === treasury.treasuryWalletAddress
    ) {
      throw new BgRewardReservationError(
        "BG_WALLET_SELECTION_REQUIRED",
        "The verified recipient wallet is not a valid independent treasury destination."
      );
    }
    const destinationTokenAccount = await deriveClassicSplAssociatedTokenAddress({
      ownerAddress: wallet.address,
      mintAddress: asset.mintAddress
    });

    const eventId = createUuidV7(now.getTime());
    const payoutIntentId = createUuidV7(now.getTime());
    const [createdEvent] = await transaction.insert(rewardEvents).values({
      id: eventId,
      programId: program.id,
      canonicalUserId: input.canonicalUserId,
      actionType: BG_DAILY_COLLECTION_ACTION,
      evidenceRef: null,
      idempotencyKey,
      amountBaseUnits: program.rewardBaseUnits,
      ruleVersion: program.ruleVersion,
      periodKey,
      status: "reserved",
      createdAt: now,
      updatedAt: now
    }).onConflictDoNothing().returning({ id: rewardEvents.id });

    if (!createdEvent) {
      const racedReservation = await findExisting();
      if (racedReservation) return racedReservation;
      throw new BgRewardReservationError(
        "BG_REWARD_INTEGRITY_ERROR",
        "A daily BG reservation conflicted without a matching event."
      );
    }

    const [updatedProgram] = await transaction.update(rewardPrograms)
      .set({
        reservedBaseUnits: sql`${rewardPrograms.reservedBaseUnits} + ${program.rewardBaseUnits}`,
        updatedAt: now
      })
      .where(and(
        eq(rewardPrograms.id, program.id),
        eq(rewardPrograms.status, "active"),
        lte(rewardPrograms.startsAt, now),
        or(isNull(rewardPrograms.endsAt), gt(rewardPrograms.endsAt, now)),
        sql`${rewardPrograms.reservedBaseUnits} + ${rewardPrograms.paidBaseUnits} + ${program.rewardBaseUnits} <= ${rewardPrograms.budgetBaseUnits}`
      ))
      .returning({ id: rewardPrograms.id });

    if (!updatedProgram) {
      const [currentProgram] = await transaction.select().from(rewardPrograms)
        .where(eq(rewardPrograms.id, program.id))
        .limit(1);
      if (
        currentProgram &&
        currentProgram.status === "active" &&
        currentProgram.startsAt <= now &&
        (currentProgram.endsAt === null || currentProgram.endsAt > now) &&
        currentProgram.reservedBaseUnits + currentProgram.paidBaseUnits + program.rewardBaseUnits >
          currentProgram.budgetBaseUnits
      ) {
        throw new BgRewardReservationError(
          "BG_REWARD_BUDGET_EXHAUSTED",
          "The approved BG reward budget cannot cover another daily reservation."
        );
      }
      throw new BgRewardReservationError(
        "BG_REWARD_RULE_CHANGED",
        "The BG reward rule changed while the reservation was being created."
      );
    }

    await transaction.insert(rewardPayoutIntents).values({
      id: payoutIntentId,
      rewardEventId: eventId,
      network: BG_REWARD_NETWORK,
      mintAddress: asset.mintAddress,
      sourceTokenAccount: treasury.tokenAccountAddress,
      destinationWallet: wallet.address,
      destinationTokenAccount,
      amountBaseUnits: program.rewardBaseUnits,
      status: "queued",
      createdAt: now,
      updatedAt: now
    });

    await transaction.insert(rewardAuditEvents).values({
      id: createUuidV7(now.getTime()),
      actorType: "service",
      actorId: input.canonicalUserId,
      action: "bg.reward.daily.reserved",
      targetType: "reward_event",
      targetId: eventId,
      reason: "Server-verified UTC daily collection reservation.",
      metadata: {
        programId: program.id,
        ruleVersion: program.ruleVersion,
        periodKey,
        amountBaseUnits: program.rewardBaseUnits.toString(),
        payoutIntentId,
        network: BG_REWARD_NETWORK
      },
      createdAt: now
    });

    return {
      outcome: "reserved" as const,
      rewardEventId: eventId,
      payoutIntentId,
      programId: program.id,
      ruleVersion: program.ruleVersion,
      periodKey,
      amountBaseUnits: program.rewardBaseUnits.toString(),
      rewardStatus: "reserved",
      payoutStatus: "queued",
      network: BG_REWARD_NETWORK,
      mintAddress: asset.mintAddress,
      destinationWallet: wallet.address,
      destinationTokenAccount
    };
  });
}
