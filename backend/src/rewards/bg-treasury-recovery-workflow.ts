import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  assetRegistry,
  bgTreasuryReconciliationSnapshots,
  bgTreasuryRecoveryProposals,
  rewardPayoutIntents,
  staffAuditEvents,
  staffPermissions,
  staffPrincipals,
  staffRoleAssignments,
  staffRolePermissions,
  staffRoles,
  treasuryAccounts
} from "../db/schema.js";

const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
const PROPOSAL_TTL_MS = 5 * 60 * 1000;
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

export type TreasuryRecoveryWorkflowErrorCode =
  | "INVALID_INPUT"
  | "STAFF_INACTIVE"
  | "STAFF_PERMISSION_REVOKED"
  | "TREASURY_NOT_FOUND"
  | "TREASURY_NOT_PAUSED"
  | "TREASURY_NOT_DEVNET"
  | "SNAPSHOT_NOT_CURRENT"
  | "SNAPSHOT_NOT_MATCHED"
  | "SNAPSHOT_STALE"
  | "TREASURY_IDENTITY_CHANGED"
  | "INVENTORY_CHANGED"
  | "PENDING_PROPOSAL_EXISTS"
  | "IDEMPOTENCY_CONFLICT"
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSAL_NOT_PENDING"
  | "PROPOSAL_EXPIRED"
  | "SELF_APPROVAL";

export class TreasuryRecoveryWorkflowError extends Error {
  constructor(
    readonly code: TreasuryRecoveryWorkflowErrorCode,
    message: string
  ) {
    super(message);
    this.name = "TreasuryRecoveryWorkflowError";
  }
}

export interface TreasuryRecoveryActor {
  staffPrincipalId: string;
  authUserId: string;
}

export interface TreasuryRecoveryProposalInput {
  treasuryAccountId: string;
  snapshotId: string;
  reason: string;
  idempotencyKey: string;
  actor: TreasuryRecoveryActor;
  requestId?: string | null;
}

export interface TreasuryRecoveryProposalResult {
  proposalId: string;
  treasuryAccountId: string;
  snapshotId: string;
  proposerStaffId: string;
  approverStaffId: string | null;
  status: "pending" | "approved" | "expired" | "consumed";
  reason: string;
  createdAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
}

async function assertStaffPermission(
  db: Database,
  actor: TreasuryRecoveryActor,
  permission: "bg.treasury.recovery.propose" | "bg.treasury.recovery.approve",
  now: Date
): Promise<void> {
  const [principal] = await db.select({
    id: staffPrincipals.id,
    authUserId: staffPrincipals.authUserId,
    status: staffPrincipals.status
  }).from(staffPrincipals)
    .where(eq(staffPrincipals.id, actor.staffPrincipalId))
    .limit(1)
    .for("update");

  if (!principal || principal.authUserId !== actor.authUserId || principal.status !== "active") {
    throw new TreasuryRecoveryWorkflowError("STAFF_INACTIVE", "The staff principal is no longer active.");
  }

  const grants = await db.select({
    permissionKey: staffPermissions.permissionKey
  }).from(staffRoleAssignments)
    .innerJoin(staffRoles, eq(staffRoleAssignments.roleId, staffRoles.id))
    .innerJoin(staffRolePermissions, eq(staffRolePermissions.roleId, staffRoles.id))
    .innerJoin(staffPermissions, eq(staffRolePermissions.permissionId, staffPermissions.id))
    .where(and(
      eq(staffRoleAssignments.staffPrincipalId, actor.staffPrincipalId),
      eq(staffRoleAssignments.status, "active"),
      lte(staffRoleAssignments.validFrom, now),
      or(isNull(staffRoleAssignments.validUntil), gt(staffRoleAssignments.validUntil, now)),
      isNull(staffRoleAssignments.revokedAt),
      eq(staffRoles.status, "active")
    ))
    .for("update");

  if (!grants.some((grant) => grant.permissionKey === permission)) {
    throw new TreasuryRecoveryWorkflowError("STAFF_PERMISSION_REVOKED", "The required staff permission is no longer active.");
  }
}

async function assertTreasuryAndSnapshot(
  db: Database,
  treasuryAccountId: string,
  snapshotId: string,
  now: Date
) {
  const [treasury] = await db.select({
    id: treasuryAccounts.id,
    status: treasuryAccounts.status,
    network: treasuryAccounts.network,
    mintAddress: treasuryAccounts.mintAddress,
    treasuryWalletAddress: treasuryAccounts.treasuryWalletAddress,
    tokenAccountAddress: treasuryAccounts.tokenAccountAddress,
    tokenProgram: assetRegistry.tokenProgram,
    updatedAt: treasuryAccounts.updatedAt
  }).from(treasuryAccounts)
    .innerJoin(assetRegistry, eq(assetRegistry.id, treasuryAccounts.assetId))
    .where(eq(treasuryAccounts.id, treasuryAccountId))
    .limit(1)
    .for("update");

  if (!treasury) {
    throw new TreasuryRecoveryWorkflowError("TREASURY_NOT_FOUND", "The Treasury account does not exist.");
  }
  if (treasury.status !== "paused") {
    throw new TreasuryRecoveryWorkflowError("TREASURY_NOT_PAUSED", "Treasury recovery proposals require a paused account.");
  }
  if (treasury.network !== "devnet") {
    throw new TreasuryRecoveryWorkflowError("TREASURY_NOT_DEVNET", "Only Devnet Treasury recovery is supported.");
  }

  const [latestSnapshot] = await db.select().from(bgTreasuryReconciliationSnapshots)
    .where(eq(bgTreasuryReconciliationSnapshots.treasuryAccountId, treasuryAccountId))
    .orderBy(desc(bgTreasuryReconciliationSnapshots.createdAt))
    .limit(1)
    .for("update");

  if (!latestSnapshot || latestSnapshot.id !== snapshotId) {
    throw new TreasuryRecoveryWorkflowError("SNAPSHOT_NOT_CURRENT", "The supplied snapshot is not the latest Treasury reconciliation.");
  }
  if (latestSnapshot.status !== "matched") {
    throw new TreasuryRecoveryWorkflowError("SNAPSHOT_NOT_MATCHED", "Treasury recovery requires a matched reconciliation snapshot.");
  }
  if (latestSnapshot.createdAt.getTime() > now.getTime() || now.getTime() - latestSnapshot.createdAt.getTime() > SNAPSHOT_MAX_AGE_MS) {
    throw new TreasuryRecoveryWorkflowError("SNAPSHOT_STALE", "The reconciliation snapshot is older than five minutes.");
  }
  if (
    latestSnapshot.network !== "devnet" ||
    treasury.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
    latestSnapshot.mintAddress !== treasury.mintAddress ||
    latestSnapshot.tokenProgram !== treasury.tokenProgram ||
    latestSnapshot.tokenAccountAddress !== treasury.tokenAccountAddress ||
    latestSnapshot.accountOwnerAddress !== treasury.treasuryWalletAddress ||
    latestSnapshot.accountMintAddress !== treasury.mintAddress ||
    latestSnapshot.accountState !== "initialized" ||
    latestSnapshot.observedSlot === null ||
    latestSnapshot.tokenBalanceBaseUnits === null ||
    latestSnapshot.availableAfterReservationsBaseUnits === null ||
    latestSnapshot.availableAfterReservationsBaseUnits < 0n ||
    treasury.updatedAt.getTime() > latestSnapshot.createdAt.getTime()
  ) {
    throw new TreasuryRecoveryWorkflowError("TREASURY_IDENTITY_CHANGED", "Treasury configuration no longer matches the reviewed snapshot.");
  }

  const [inventory] = await db.select({
    reserved: sql<string>`coalesce(sum(${rewardPayoutIntents.amountBaseUnits}) FILTER (WHERE ${rewardPayoutIntents.status} IN (${sql.join(RESERVED_PAYOUT_STATUSES.map((status) => sql`${status}`), sql`, `)})), 0)::text`,
    paid: sql<string>`coalesce(sum(${rewardPayoutIntents.amountBaseUnits}) FILTER (WHERE ${rewardPayoutIntents.status} = 'paid'), 0)::text`
  }).from(rewardPayoutIntents)
    .where(eq(rewardPayoutIntents.treasuryAccountId, treasuryAccountId));

  if (
    BigInt(inventory?.reserved ?? "0") !== latestSnapshot.reservedBaseUnits ||
    BigInt(inventory?.paid ?? "0") !== latestSnapshot.paidBaseUnits
  ) {
    throw new TreasuryRecoveryWorkflowError("INVENTORY_CHANGED", "Payout reservations or settlements changed after reconciliation; a fresh snapshot is required.");
  }

  return { treasury, snapshot: latestSnapshot };
}

async function appendAudit(
  db: Database,
  input: {
    actorStaffId: string;
    subjectStaffId: string;
    action: string;
    reason: string;
    requestId?: string | null;
    metadata: Record<string, unknown>;
    now: Date;
  }
) {
  await db.insert(staffAuditEvents).values({
    id: createUuidV7(input.now.getTime()),
    actorStaffId: input.actorStaffId,
    subjectStaffId: input.subjectStaffId,
    action: input.action,
    reason: input.reason,
    requestId: input.requestId ?? null,
    metadata: input.metadata,
    createdAt: input.now
  });
}

function toResult(row: typeof bgTreasuryRecoveryProposals.$inferSelect): TreasuryRecoveryProposalResult {
  return {
    proposalId: row.id,
    treasuryAccountId: row.treasuryAccountId,
    snapshotId: row.snapshotId,
    proposerStaffId: row.proposerStaffId,
    approverStaffId: row.approverStaffId,
    status: row.status as TreasuryRecoveryProposalResult["status"],
    reason: row.reason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    approvedAt: row.approvedAt
  };
}

export async function proposeBgTreasuryRecovery(
  db: Database,
  input: TreasuryRecoveryProposalInput,
  now = new Date()
): Promise<TreasuryRecoveryProposalResult> {
  const reason = input.reason.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (
    !input.treasuryAccountId ||
    !input.snapshotId ||
    reason.length < 1 ||
    reason.length > 1000 ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128 ||
    Number.isNaN(now.getTime())
  ) {
    throw new TreasuryRecoveryWorkflowError("INVALID_INPUT", "Treasury, snapshot, reason, and a 16-128 character idempotency key are required.");
  }

  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as Database;
    await assertStaffPermission(transactionDb, input.actor, "bg.treasury.recovery.propose", now);
    await assertTreasuryAndSnapshot(transactionDb, input.treasuryAccountId, input.snapshotId, now);

    const [existingIdempotency] = await tx.select().from(bgTreasuryRecoveryProposals)
      .where(and(
        eq(bgTreasuryRecoveryProposals.proposerStaffId, input.actor.staffPrincipalId),
        eq(bgTreasuryRecoveryProposals.idempotencyKey, idempotencyKey)
      ))
      .limit(1)
      .for("update");

    if (existingIdempotency) {
      if (
        existingIdempotency.treasuryAccountId !== input.treasuryAccountId ||
        existingIdempotency.snapshotId !== input.snapshotId ||
        existingIdempotency.reason !== reason
      ) {
        throw new TreasuryRecoveryWorkflowError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different recovery request.");
      }
      return toResult(existingIdempotency);
    }

    const [pending] = await tx.select().from(bgTreasuryRecoveryProposals)
      .where(and(
        eq(bgTreasuryRecoveryProposals.treasuryAccountId, input.treasuryAccountId),
        eq(bgTreasuryRecoveryProposals.status, "pending")
      ))
      .limit(1)
      .for("update");

    if (pending && pending.expiresAt.getTime() <= now.getTime()) {
      await tx.update(bgTreasuryRecoveryProposals)
        .set({ status: "expired" })
        .where(eq(bgTreasuryRecoveryProposals.id, pending.id));
      await appendAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: pending.proposerStaffId,
        action: "bg.treasury.recovery.expired",
        reason: "Pending Treasury recovery proposal expired before approval.",
        requestId: input.requestId,
        metadata: { proposalId: pending.id, treasuryAccountId: pending.treasuryAccountId, snapshotId: pending.snapshotId },
        now
      });
    } else if (pending) {
      throw new TreasuryRecoveryWorkflowError("PENDING_PROPOSAL_EXISTS", "A non-expired recovery proposal already exists for this Treasury.");
    }

    const proposalId = createUuidV7(now.getTime());
    const expiresAt = new Date(now.getTime() + PROPOSAL_TTL_MS);
    const [created] = await tx.insert(bgTreasuryRecoveryProposals).values({
      id: proposalId,
      treasuryAccountId: input.treasuryAccountId,
      snapshotId: input.snapshotId,
      proposerStaffId: input.actor.staffPrincipalId,
      status: "pending",
      reason,
      idempotencyKey,
      createdAt: now,
      expiresAt
    }).returning();

    await appendAudit(transactionDb, {
      actorStaffId: input.actor.staffPrincipalId,
      subjectStaffId: input.actor.staffPrincipalId,
      action: "bg.treasury.recovery.proposed",
      reason,
      requestId: input.requestId,
      metadata: {
        proposalId,
        treasuryAccountId: input.treasuryAccountId,
        snapshotId: input.snapshotId,
        expiresAt: expiresAt.toISOString()
      },
      now
    });

    return toResult(created);
  });
}

export async function approveBgTreasuryRecovery(
  db: Database,
  input: {
    proposalId: string;
    reason: string;
    actor: TreasuryRecoveryActor;
    requestId?: string | null;
  },
  now = new Date()
): Promise<TreasuryRecoveryProposalResult> {
  const reason = input.reason.trim();
  if (!input.proposalId || reason.length < 1 || reason.length > 1000 || Number.isNaN(now.getTime())) {
    throw new TreasuryRecoveryWorkflowError("INVALID_INPUT", "A proposal ID and non-empty approval reason are required.");
  }

  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as Database;
    await assertStaffPermission(transactionDb, input.actor, "bg.treasury.recovery.approve", now);

    const [proposalReference] = await tx.select({
      treasuryAccountId: bgTreasuryRecoveryProposals.treasuryAccountId
    }).from(bgTreasuryRecoveryProposals)
      .where(eq(bgTreasuryRecoveryProposals.id, input.proposalId))
      .limit(1);

    if (!proposalReference) {
      throw new TreasuryRecoveryWorkflowError("PROPOSAL_NOT_FOUND", "The Treasury recovery proposal does not exist.");
    }

    await assertTreasuryAndSnapshot(
      transactionDb,
      proposalReference.treasuryAccountId,
      (await tx.select({ snapshotId: bgTreasuryRecoveryProposals.snapshotId })
        .from(bgTreasuryRecoveryProposals)
        .where(eq(bgTreasuryRecoveryProposals.id, input.proposalId))
        .limit(1))[0]!.snapshotId,
      now
    );

    const [proposal] = await tx.select().from(bgTreasuryRecoveryProposals)
      .where(eq(bgTreasuryRecoveryProposals.id, input.proposalId))
      .limit(1)
      .for("update");

    if (!proposal) {
      throw new TreasuryRecoveryWorkflowError("PROPOSAL_NOT_FOUND", "The Treasury recovery proposal does not exist.");
    }
    if (proposal.proposerStaffId === input.actor.staffPrincipalId) {
      throw new TreasuryRecoveryWorkflowError("SELF_APPROVAL", "The proposer cannot approve their own Treasury recovery proposal.");
    }
    if (proposal.status !== "pending") {
      throw new TreasuryRecoveryWorkflowError("PROPOSAL_NOT_PENDING", "Only a pending Treasury recovery proposal can be approved.");
    }
    if (proposal.expiresAt.getTime() <= now.getTime()) {
      await tx.update(bgTreasuryRecoveryProposals)
        .set({ status: "expired" })
        .where(eq(bgTreasuryRecoveryProposals.id, proposal.id));
      await appendAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: proposal.proposerStaffId,
        action: "bg.treasury.recovery.expired",
        reason: "Treasury recovery proposal expired before approval.",
        requestId: input.requestId,
        metadata: { proposalId: proposal.id, treasuryAccountId: proposal.treasuryAccountId, snapshotId: proposal.snapshotId },
        now
      });
      return toResult({ ...proposal, status: "expired" });
    }

    const [approved] = await tx.update(bgTreasuryRecoveryProposals)
      .set({
        status: "approved",
        approverStaffId: input.actor.staffPrincipalId,
        approvedAt: now
      })
      .where(and(
        eq(bgTreasuryRecoveryProposals.id, proposal.id),
        eq(bgTreasuryRecoveryProposals.status, "pending")
      ))
      .returning();

    if (!approved) {
      throw new TreasuryRecoveryWorkflowError("PROPOSAL_NOT_PENDING", "The Treasury recovery proposal was already resolved.");
    }

    await appendAudit(transactionDb, {
      actorStaffId: input.actor.staffPrincipalId,
      subjectStaffId: proposal.proposerStaffId,
      action: "bg.treasury.recovery.approved",
      reason,
      requestId: input.requestId,
      metadata: {
        proposalId: proposal.id,
        treasuryAccountId: proposal.treasuryAccountId,
        snapshotId: proposal.snapshotId,
        proposerStaffId: proposal.proposerStaffId,
        approverStaffId: input.actor.staffPrincipalId
      },
      now
    });

    return toResult(approved);
  });
}
