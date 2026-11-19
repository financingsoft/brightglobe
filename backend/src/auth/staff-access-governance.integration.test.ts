import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "../db/client.js";
import {
  schema,
  staffAccessChangeRequests,
  staffAuditEvents,
  staffPrincipals,
  staffRoleAssignments,
  staffRoles
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  approveStaffAccessChange,
  executeStaffAccessChange,
  proposeStaffAccessChange,
  StaffAccessGovernanceError
} from "./staff-access-governance.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

test("staff access provisioning, role changes, and suspension require independent approval and execution", {
  skip: !connectionString ? "BG_REWARD_TEST_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new PgPool({ connectionString });
  const client = await pool.connect();
  const rootDb = drizzle(client, { schema }) as unknown as Database;
  const now = new Date("2026-11-19T12:00:00.000Z");
  const suffix = createUuidV7(now.getTime()).slice(-8);
  const proposerUserId = "access-proposer-" + suffix;
  const approverUserId = "access-approver-" + suffix;
  const targetUserId = "access-target-" + suffix;
  const expiredTargetUserId = "access-expired-target-" + suffix;
  const proposerId = createUuidV7(now.getTime());
  const approverId = createUuidV7(now.getTime());
  const proposer = { staffPrincipalId: proposerId, authUserId: proposerUserId };
  const approver = { staffPrincipalId: approverId, authUserId: approverUserId };
  const rollback = new Error("rollback integration fixture");

  try {
    await rootDb.transaction(async (tx) => {
      const db = tx as unknown as Database;
      await client.query(
        'INSERT INTO public."user" (id, name, email) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)',
        [
          proposerUserId, "CI access proposer", proposerUserId + "@example.invalid",
          approverUserId, "CI access approver", approverUserId + "@example.invalid",
          targetUserId, "CI access target", targetUserId + "@example.invalid",
          expiredTargetUserId, "CI expired access target", expiredTargetUserId + "@example.invalid"
        ]
      );

      await tx.insert(staffPrincipals).values([
        { id: proposerId, authUserId: proposerUserId, status: "active", displayLabel: "CI access proposer", createdAt: now, updatedAt: now },
        { id: approverId, authUserId: approverUserId, status: "active", displayLabel: "CI access approver", createdAt: now, updatedAt: now }
      ]);

      const roles = await tx.select({
        id: staffRoles.id,
        key: staffRoles.roleKey
      }).from(staffRoles).where(inArray(staffRoles.roleKey, [
        "staff_access_proposer",
        "staff_access_approver",
        "treasury_observer",
        "treasury_recovery_proposer"
      ]));
      const roleId = (key: string) => roles.find((role) => role.key === key)?.id;
      const proposerRoleId = roleId("staff_access_proposer");
      const approverRoleId = roleId("staff_access_approver");
      const observerRoleId = roleId("treasury_observer");
      const recoveryProposerRoleId = roleId("treasury_recovery_proposer");
      assert.ok(proposerRoleId && approverRoleId && observerRoleId && recoveryProposerRoleId);

      await tx.insert(staffRoleAssignments).values([
        { id: createUuidV7(now.getTime()), staffPrincipalId: proposerId, roleId: proposerRoleId, status: "active", validFrom: new Date(now.getTime() - 60_000), validUntil: new Date(now.getTime() + 1_800_000), createdAt: now },
        { id: createUuidV7(now.getTime()), staffPrincipalId: approverId, roleId: approverRoleId, status: "active", validFrom: new Date(now.getTime() - 60_000), validUntil: new Date(now.getTime() + 1_800_000), createdAt: now }
      ]);

      await assert.rejects(
        () => proposeStaffAccessChange(db, {
          action: "suspend_principal",
          targetStaffPrincipalId: approverId,
          reason: "This would remove the only active staff access approver.",
          idempotencyKey: "access-last-approver-" + suffix,
          actor: proposer
        }, now),
        (error: unknown) => error instanceof StaffAccessGovernanceError && error.code === "LAST_ACCESS_APPROVER"
      );

      const provisionInput = {
        action: "provision_principal" as const,
        targetAuthUserId: targetUserId,
        roleId: observerRoleId,
        displayLabel: "Provisioned CI Staff",
        reason: "Provision the existing Better Auth user with the read-only Treasury observer role.",
        idempotencyKey: "access-provision-key-" + suffix,
        actor: proposer
      };
      const provision = await proposeStaffAccessChange(db, provisionInput, now);
      const provisionReplay = await proposeStaffAccessChange(db, provisionInput, now);
      assert.equal(provisionReplay.requestId, provision.requestId);

      await assert.rejects(
        () => approveStaffAccessChange(db, {
          requestId: provision.requestId,
          reason: "The proposer cannot approve the same request.",
          actor: proposer
        }, now),
        (error: unknown) => error instanceof StaffAccessGovernanceError && error.code === "STAFF_PERMISSION_REVOKED"
      );

      const approvedProvision = await approveStaffAccessChange(db, {
        requestId: provision.requestId,
        reason: "Independent access approver verifies the target identity and least-privilege role.",
        actor: approver
      }, now);
      assert.equal(approvedProvision.status, "approved");

      await assert.rejects(
        () => executeStaffAccessChange(db, {
          requestId: provision.requestId,
          reason: "The proposer cannot execute the approved access change.",
          actor: proposer
        }, new Date(now.getTime() + 30_000)),
        (error: unknown) => error instanceof StaffAccessGovernanceError && error.code === "NOT_APPROVER"
      );

      const provisioned = await executeStaffAccessChange(db, {
        requestId: provision.requestId,
        reason: "The independent approver executes the approved least-privilege provisioning.",
        actor: approver
      }, new Date(now.getTime() + 60_000));
      assert.equal(provisioned.status, "consumed");
      assert.ok(provisioned.resultStaffPrincipalId);

      const targetPrincipalId = provisioned.resultStaffPrincipalId!;
      const [targetPrincipal] = await tx.select({
        status: staffPrincipals.status,
        displayLabel: staffPrincipals.displayLabel
      }).from(staffPrincipals).where(eq(staffPrincipals.id, targetPrincipalId));
      assert.equal(targetPrincipal?.status, "active");
      assert.equal(targetPrincipal?.displayLabel, "Provisioned CI Staff");

      const assign = await proposeStaffAccessChange(db, {
        action: "assign_role",
        targetStaffPrincipalId: targetPrincipalId,
        roleId: recoveryProposerRoleId,
        reason: "Grant the provisioned staff member the Treasury recovery proposer role.",
        idempotencyKey: "access-assign-key-" + suffix,
        actor: proposer
      }, new Date(now.getTime() + 60_000));
      await approveStaffAccessChange(db, {
        requestId: assign.requestId,
        reason: "Approve the additional least-privilege proposer role.",
        actor: approver
      }, new Date(now.getTime() + 60_000));
      const assigned = await executeStaffAccessChange(db, {
        requestId: assign.requestId,
        reason: "Execute the approved role assignment.",
        actor: approver
      }, new Date(now.getTime() + 90_000));
      assert.equal(assigned.status, "consumed");

      const revoke = await proposeStaffAccessChange(db, {
        action: "revoke_role",
        targetStaffPrincipalId: targetPrincipalId,
        roleId: observerRoleId,
        reason: "Revoke the original observer role after the role change.",
        idempotencyKey: "access-revoke-key-" + suffix,
        actor: proposer
      }, new Date(now.getTime() + 90_000));
      await approveStaffAccessChange(db, {
        requestId: revoke.requestId,
        reason: "Approve revocation of the observer role.",
        actor: approver
      }, new Date(now.getTime() + 90_000));
      const revoked = await executeStaffAccessChange(db, {
        requestId: revoke.requestId,
        reason: "Execute the approved role revocation.",
        actor: approver
      }, new Date(now.getTime() + 120_000));
      assert.equal(revoked.status, "consumed");

      const suspend = await proposeStaffAccessChange(db, {
        action: "suspend_principal",
        targetStaffPrincipalId: targetPrincipalId,
        reason: "Suspend the provisioned staff principal after the access review.",
        idempotencyKey: "access-suspend-key-" + suffix,
        actor: proposer
      }, new Date(now.getTime() + 120_000));
      await approveStaffAccessChange(db, {
        requestId: suspend.requestId,
        reason: "Approve suspension of the target staff principal.",
        actor: approver
      }, new Date(now.getTime() + 120_000));
      const suspended = await executeStaffAccessChange(db, {
        requestId: suspend.requestId,
        reason: "Execute the approved principal suspension.",
        actor: approver
      }, new Date(now.getTime() + 150_000));
      assert.equal(suspended.status, "consumed");

      const expiringRequest = await proposeStaffAccessChange(db, {
        action: "provision_principal",
        targetAuthUserId: expiredTargetUserId,
        roleId: observerRoleId,
        displayLabel: "Expired CI Staff",
        reason: "Exercise expiry of an approved staff access request.",
        idempotencyKey: "access-expired-key-" + suffix,
        actor: proposer
      }, new Date(now.getTime() + 150_000));
      await approveStaffAccessChange(db, {
        requestId: expiringRequest.requestId,
        reason: "Approve the access request for expiry coverage.",
        actor: approver
      }, new Date(now.getTime() + 150_000));
      const expiredResult = await executeStaffAccessChange(db, {
        requestId: expiringRequest.requestId,
        reason: "Execution is attempted after the approval window.",
        actor: approver
      }, new Date(now.getTime() + 7 * 60 * 1000));
      assert.equal(expiredResult.status, "expired");

      const [expiredTarget] = await tx.select({ id: staffPrincipals.id })
        .from(staffPrincipals)
        .where(eq(staffPrincipals.authUserId, expiredTargetUserId));
      assert.equal(expiredTarget, undefined);

      const [finalPrincipal] = await tx.select({ status: staffPrincipals.status })
        .from(staffPrincipals)
        .where(eq(staffPrincipals.id, targetPrincipalId));
      assert.equal(finalPrincipal?.status, "suspended");

      const [provisionRequest] = await tx.select({
        status: staffAccessChangeRequests.status,
        resultStaffPrincipalId: staffAccessChangeRequests.resultStaffPrincipalId
      }).from(staffAccessChangeRequests)
        .where(eq(staffAccessChangeRequests.id, provision.requestId));
      assert.equal(provisionRequest?.status, "consumed");
      assert.equal(provisionRequest?.resultStaffPrincipalId, targetPrincipalId);

      const audit = await tx.select({ action: staffAuditEvents.action })
        .from(staffAuditEvents)
        .where(and(
          inArray(staffAuditEvents.action, [
            "bg.staff.access.proposed",
            "bg.staff.access.approved",
            "bg.staff.access.executed",
            "bg.staff.principal.provisioned",
            "bg.staff.role.assigned",
            "bg.staff.role.revoked",
            "bg.staff.principal.suspended",
            "bg.staff.access.expired"
          ]),
          eq(staffAuditEvents.actorStaffId, approverId)
        ));
      assert.ok(audit.some((item) => item.action === "bg.staff.principal.provisioned"));
      assert.ok(audit.some((item) => item.action === "bg.staff.role.assigned"));
      assert.ok(audit.some((item) => item.action === "bg.staff.role.revoked"));
      assert.ok(audit.some((item) => item.action === "bg.staff.principal.suspended"));
      assert.equal(audit.filter((item) => item.action === "bg.staff.access.executed").length, 4);
      assert.ok(audit.some((item) => item.action === "bg.staff.access.expired"));

      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
