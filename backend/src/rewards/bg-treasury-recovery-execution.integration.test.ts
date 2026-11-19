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
  bgTreasuryRecoveryProposals,
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
  executeBgTreasuryRecovery,
  proposeBgTreasuryRecovery,
  TreasuryRecoveryWorkflowError
} from "./bg-treasury-recovery-workflow.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

test("approved Treasury recovery executes one atomic paused-to-active transition with fresh finalized evidence", {
  skip: !connectionString ? "BG_REWARD_TEST_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new PgPool({ connectionString });
  const client = await pool.connect();
  const rootDb = drizzle(client, { schema }) as unknown as Database;
  const now = new Date("2026-11-19T12:00:00.000Z");
  const suffix = createUuidV7(now.getTime()).slice(-8);
  const proposerUserId = "recovery-exec-proposer-" + suffix;
  const approverUserId = "recovery-exec-approver-" + suffix;
  const proposerId = createUuidV7(now.getTime());
  const approverId = createUuidV7(now.getTime());
  const proposerRoleId = createUuidV7(now.getTime());
  const approverRoleId = createUuidV7(now.getTime());
  const treasuryId = createUuidV7(now.getTime());
  const assetId = createUuidV7(now.getTime());
  const snapshotId = createUuidV7(now.getTime());
  const rollback = new Error("rollback integration fixture");

  try {
    await rootDb.transaction(async (tx) => {
      const db = tx as unknown as Database;
      await client.query(
        'INSERT INTO public."user" (id, name, email) VALUES ($1, $2, $3), ($4, $5, $6)',
        [
          proposerUserId, "CI recovery execution proposer", proposerUserId + "@example.invalid",
          approverUserId, "CI recovery execution approver", approverUserId + "@example.invalid"
        ]
      );

      await tx.insert(staffPrincipals).values([
        { id: proposerId, authUserId: proposerUserId, status: "active", displayLabel: "CI execution proposer", createdAt: now, updatedAt: now },
        { id: approverId, authUserId: approverUserId, status: "active", displayLabel: "CI execution approver", createdAt: now, updatedAt: now }
      ]);
      await tx.insert(staffRoles).values([
        { id: proposerRoleId, roleKey: "ci_exec_proposer_" + suffix, displayName: "CI Execution Proposer", status: "active", createdAt: now },
        { id: approverRoleId, roleKey: "ci_exec_approver_" + suffix, displayName: "CI Execution Approver", status: "active", createdAt: now }
      ]);

      const permissions = await tx.select({
        id: staffPermissions.id,
        key: staffPermissions.permissionKey
      }).from(staffPermissions).where(inArray(staffPermissions.permissionKey, [
        "bg.treasury.recovery.propose",
        "bg.treasury.recovery.approve",
        "bg.treasury.recovery.execute"
      ]));
      const proposePermission = permissions.find((item) => item.key === "bg.treasury.recovery.propose");
      const approvePermission = permissions.find((item) => item.key === "bg.treasury.recovery.approve");
      const executePermission = permissions.find((item) => item.key === "bg.treasury.recovery.execute");
      assert.ok(proposePermission && approvePermission && executePermission);

      await tx.insert(staffRolePermissions).values([
        { roleId: proposerRoleId, permissionId: proposePermission.id, createdAt: now },
        // Give the proposer execute permission in this adversarial fixture to
        // prove the service also binds execution to the actual approver.
        { roleId: proposerRoleId, permissionId: executePermission.id, createdAt: now },
        { roleId: approverRoleId, permissionId: approvePermission.id, createdAt: now },
        { roleId: approverRoleId, permissionId: executePermission.id, createdAt: now }
      ]);
      await tx.insert(staffRoleAssignments).values([
        { id: createUuidV7(now.getTime()), staffPrincipalId: proposerId, roleId: proposerRoleId, status: "active", validFrom: new Date(now.getTime() - 60_000), validUntil: new Date(now.getTime() + 600_000), createdAt: now },
        { id: createUuidV7(now.getTime()), staffPrincipalId: approverId, roleId: approverRoleId, status: "active", validFrom: new Date(now.getTime() - 60_000), validUntil: new Date(now.getTime() + 600_000), createdAt: now }
      ]);

      const mintAddress = "exec-mint-" + suffix;
      const walletAddress = "exec-wallet-" + suffix;
      const tokenAccountAddress = "exec-token-" + suffix;
      await tx.insert(assetRegistry).values({
        id: assetId,
        assetCode: "EX" + suffix,
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
        treasuryWalletAddress: walletAddress,
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
        accountOwnerAddress: walletAddress,
        accountMintAddress: mintAddress,
        accountState: "initialized",
        observedSlot: 200n,
        tokenBalanceBaseUnits: 250n,
        reservedBaseUnits: 0n,
        paidBaseUnits: 0n,
        availableAfterReservationsBaseUnits: 250n,
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
      const proposal = await proposeBgTreasuryRecovery(db, {
        treasuryAccountId: treasuryId,
        snapshotId,
        reason: "Request controlled recovery after a fresh finalized Devnet reconciliation.",
        idempotencyKey: "recovery-execute-key-" + suffix,
        actor: proposer
      }, now);
      const approved = await approveBgTreasuryRecovery(db, {
        proposalId: proposal.proposalId,
        reason: "Independent approval after verifying the Treasury and snapshot binding.",
        actor: approver
      }, now);
      assert.equal(approved.status, "approved");

      await assert.rejects(
        () => executeBgTreasuryRecovery(db, {
          proposalId: proposal.proposalId,
          reason: "Attempted execution by the proposer.",
          actor: proposer
        }, new Date(now.getTime() + 60_000)),
        (error: unknown) => error instanceof TreasuryRecoveryWorkflowError && error.code === "NOT_APPROVER"
      );

      const executed = await executeBgTreasuryRecovery(db, {
        proposalId: proposal.proposalId,
        reason: "The approving operator re-verifies the finalized Devnet inventory and executes the state transition.",
        actor: approver
      }, new Date(now.getTime() + 2 * 60 * 1000));
      assert.equal(executed.status, "consumed");
      assert.equal(executed.approverStaffId, approverId);

      const [treasury] = await tx.select({ status: treasuryAccounts.status })
        .from(treasuryAccounts)
        .where(eq(treasuryAccounts.id, treasuryId));
      assert.equal(treasury?.status, "active");

      const [storedProposal] = await tx.select({ status: bgTreasuryRecoveryProposals.status })
        .from(bgTreasuryRecoveryProposals)
        .where(eq(bgTreasuryRecoveryProposals.id, proposal.proposalId));
      assert.equal(storedProposal?.status, "consumed");

      const audit = await tx.select({ action: staffAuditEvents.action })
        .from(staffAuditEvents)
        .where(and(
          inArray(staffAuditEvents.action, [
            "bg.treasury.recovery.proposed",
            "bg.treasury.recovery.approved",
            "bg.treasury.recovery.executed"
          ]),
          eq(staffAuditEvents.subjectStaffId, proposerId)
        ));
      assert.deepEqual(audit.map((item) => item.action).sort(), [
        "bg.treasury.recovery.approved",
        "bg.treasury.recovery.executed",
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
