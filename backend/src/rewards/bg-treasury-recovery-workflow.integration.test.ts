import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import type { Database } from "../db/client.js";
import {
  assetRegistry,
  bgTreasuryReconciliationSnapshots,
  schema,
  staffAuditEvents,
  staffPermissions,
  staffPrincipals,
  staffRoleAssignments,
  staffRolePermissions,
  staffRoles,
  treasuryAccounts
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  approveBgTreasuryRecovery,
  proposeBgTreasuryRecovery,
  TreasuryRecoveryWorkflowError
} from "./bg-treasury-recovery-workflow.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

test("Treasury recovery proposal requires fresh matched inventory and distinct authorized approver", {
  skip: !connectionString ? "BG_REWARD_TEST_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new PgPool({ connectionString });
  const client = await pool.connect();
  const rootDb = drizzle(client, { schema }) as unknown as Database;
  const now = new Date("2026-11-19T12:00:00.000Z");
  const suffix = createUuidV7(now.getTime()).slice(-8);
  const proposerUserId = `recovery-proposer-${suffix}`;
  const approverUserId = `recovery-approver-${suffix}`;
  const proposerId = createUuidV7(now.getTime());
  const approverId = createUuidV7(now.getTime());
  const proposerRoleId = createUuidV7(now.getTime());
  const approverRoleId = createUuidV7(now.getTime());
  const treasuryId = createUuidV7(now.getTime());
  const assetId = createUuidV7(now.getTime());
  const snapshotId = createUuidV7(now.getTime());
  const proposerAssignmentId = createUuidV7(now.getTime());
  const approverAssignmentId = createUuidV7(now.getTime());
  const rollback = new Error("rollback integration fixture");

  try {
    await rootDb.transaction(async (tx) => {
      const db = tx as unknown as Database;

      await client.query(
        `INSERT INTO public."user" (id, name, email) VALUES
          ($1, 'CI recovery proposer', $2),
          ($3, 'CI recovery approver', $4)`,
        [proposerUserId, `${proposerUserId}@example.invalid`, approverUserId, `${approverUserId}@example.invalid`]
      );

      await tx.insert(staffPrincipals).values([
        { id: proposerId, authUserId: proposerUserId, status: "active", displayLabel: "CI recovery proposer", createdAt: now, updatedAt: now },
        { id: approverId, authUserId: approverUserId, status: "active", displayLabel: "CI recovery approver", createdAt: now, updatedAt: now }
      ]);
      await tx.insert(staffRoles).values([
        { id: proposerRoleId, roleKey: `ci_recovery_proposer_${suffix}`, displayName: "CI Recovery Proposer", status: "active", createdAt: now },
        { id: approverRoleId, roleKey: `ci_recovery_approver_${suffix}`, displayName: "CI Recovery Approver", status: "active", createdAt: now }
      ]);

      const permissionRows = await tx.select({
        id: staffPermissions.id,
        key: staffPermissions.permissionKey
      }).from(staffPermissions)
        .where(inArray(staffPermissions.permissionKey, [
          "bg.treasury.recovery.propose",
          "bg.treasury.recovery.approve"
        ]));
      const proposePermission = permissionRows.find((row) => row.key === "bg.treasury.recovery.propose");
      const approvePermission = permissionRows.find((row) => row.key === "bg.treasury.recovery.approve");
      assert.ok(proposePermission);
      assert.ok(approvePermission);

      await tx.insert(staffRolePermissions).values([
        { roleId: proposerRoleId, permissionId: proposePermission.id, createdAt: now },
        { roleId: proposerRoleId, permissionId: approvePermission.id, createdAt: now },
        { roleId: approverRoleId, permissionId: approvePermission.id, createdAt: now }
      ]);
      await tx.insert(staffRoleAssignments).values([
        { id: proposerAssignmentId, staffPrincipalId: proposerId, roleId: proposerRoleId, status: "active", validFrom: new Date(now.getTime() - 60_000), validUntil: new Date(now.getTime() + 600_000), createdAt: now },
        { id: approverAssignmentId, staffPrincipalId: approverId, roleId: approverRoleId, status: "active", validFrom: new Date(now.getTime() - 60_000), validUntil: new Date(now.getTime() + 600_000), createdAt: now }
      ]);

      const mintAddress = `mint-${suffix}`;
      const treasuryWalletAddress = `wallet-${suffix}`;
      const tokenAccountAddress = `token-account-${suffix}`;
      await tx.insert(assetRegistry).values({
        id: assetId,
        assetCode: `BG${suffix}`,
        network: "devnet",
        tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
        mintAddress,
        decimals: 9,
        status: "active",
        metadataSource: "unconfigured",
        createdAt: now,
        updatedAt: now
      });
      await tx.insert(treasuryAccounts).values({
        id: treasuryId,
        assetId,
        network: "devnet",
        mintAddress,
        treasuryWalletAddress,
        tokenAccountAddress,
        signerProvider: "devnet_local",
        hotWalletCapBaseUnits: 0n,
        status: "paused",
        lastReconciledAt: now,
        createdAt: now,
        updatedAt: now
      });
      await tx.insert(bgTreasuryReconciliationSnapshots).values({
        id: snapshotId,
        treasuryAccountId: treasuryId,
        network: "devnet",
        mintAddress,
        tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
        tokenAccountAddress,
        accountOwnerAddress: treasuryWalletAddress,
        accountMintAddress: mintAddress,
        accountState: "initialized",
        observedSlot: 100n,
        tokenBalanceBaseUnits: 100n,
        reservedBaseUnits: 0n,
        paidBaseUnits: 0n,
        availableAfterReservationsBaseUnits: 100n,
        status: "matched",
        discrepancyCode: null,
        evidence: {
          finalizedAccountRead: true,
          mintDecimals: 9,
          mintAccountProgramOwner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
          tokenAccountProgramOwner: CLASSIC_SPL_TOKEN_PROGRAM_ID
        },
        createdAt: now
      });

      const proposer = { staffPrincipalId: proposerId, authUserId: proposerUserId };
      const approver = { staffPrincipalId: approverId, authUserId: approverUserId };
      const proposalInput = {
        treasuryAccountId: treasuryId,
        snapshotId,
        reason: "Confirm the paused Devnet Treasury has a current matched inventory snapshot.",
        idempotencyKey: `recovery-test-key-${suffix}`,
        actor: proposer
      };

      const proposal = await proposeBgTreasuryRecovery(db, proposalInput, now);
      assert.equal(proposal.status, "pending");
      assert.equal(proposal.proposerStaffId, proposerId);
      assert.equal(proposal.approverStaffId, null);

      const replay = await proposeBgTreasuryRecovery(db, proposalInput, now);
      assert.equal(replay.proposalId, proposal.proposalId);

      await assert.rejects(
        () => proposeBgTreasuryRecovery(db, {
          ...proposalInput,
          reason: "A different request under the same idempotency key."
        }, now),
        (error: unknown) => error instanceof TreasuryRecoveryWorkflowError && error.code === "IDEMPOTENCY_CONFLICT"
      );

      await assert.rejects(
        () => approveBgTreasuryRecovery(db, {
          proposalId: proposal.proposalId,
          reason: "Attempt self-approval.",
          actor: proposer
        }, now),
        (error: unknown) => error instanceof TreasuryRecoveryWorkflowError && error.code === "SELF_APPROVAL"
      );

      const approved = await approveBgTreasuryRecovery(db, {
        proposalId: proposal.proposalId,
        reason: "Independent reviewer confirms the same latest reconciliation snapshot.",
        actor: approver
      }, now);
      assert.equal(approved.status, "approved");
      assert.equal(approved.approverStaffId, approverId);

      await assert.rejects(
        () => approveBgTreasuryRecovery(db, {
          proposalId: proposal.proposalId,
          reason: "Replay approval.",
          actor: approver
        }, now),
        (error: unknown) => error instanceof TreasuryRecoveryWorkflowError && error.code === "PROPOSAL_NOT_PENDING"
      );

      const expiredProposal = await proposeBgTreasuryRecovery(db, {
        ...proposalInput,
        idempotencyKey: "recovery-expired-key-" + suffix
      }, now);
      const expiredResult = await approveBgTreasuryRecovery(db, {
        proposalId: expiredProposal.proposalId,
        reason: "The approval window elapsed; the proposal must expire without checking stale inventory.",
        actor: approver
      }, new Date(now.getTime() + 6 * 60 * 1000));
      assert.equal(expiredResult.status, "expired");

      const [treasury] = await tx.select({ status: treasuryAccounts.status })
        .from(treasuryAccounts)
        .where(eq(treasuryAccounts.id, treasuryId));
      assert.equal(treasury?.status, "paused");

      const audit = await tx.select({ action: staffAuditEvents.action })
        .from(staffAuditEvents)
        .where(and(
          inArray(staffAuditEvents.action, [
            "bg.treasury.recovery.proposed",
            "bg.treasury.recovery.approved",
            "bg.treasury.recovery.expired"
          ]),
          eq(staffAuditEvents.subjectStaffId, proposerId)
        ));
      assert.deepEqual(audit.map((row) => row.action).sort(), [
        "bg.treasury.recovery.approved",
        "bg.treasury.recovery.expired",
        "bg.treasury.recovery.proposed",
        "bg.treasury.recovery.proposed"
      ]);

      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
