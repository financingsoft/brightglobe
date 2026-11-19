import { and, asc, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  staffAccessChangeRequests,
  staffAccessGovernanceMutex,
  staffAuditEvents,
  staffPermissions,
  staffPrincipals,
  staffRoleAssignments,
  staffRolePermissions,
  staffRoles,
  user
} from "../db/schema.js";

const ACCESS_REQUEST_TTL_MS = 5 * 60 * 1000;
const ACCESS_APPROVAL_TTL_MS = 5 * 60 * 1000;

export type StaffAccessAction = "provision_principal" | "assign_role" | "revoke_role" | "suspend_principal" | "activate_principal";
export type StaffAccessPermission = "bg.staff.access.propose" | "bg.staff.access.approve" | "bg.staff.access.execute";

export type StaffAccessErrorCode =
  | "INVALID_INPUT"
  | "STAFF_INACTIVE"
  | "STAFF_PERMISSION_REVOKED"
  | "SELF_TARGET"
  | "TARGET_NOT_FOUND"
  | "TARGET_ALREADY_STAFF"
  | "PRINCIPAL_NOT_ACTIVE"
  | "PRINCIPAL_NOT_SUSPENDED"
  | "ROLE_NOT_FOUND"
  | "ROLE_DISABLED"
  | "ROLE_ALREADY_ASSIGNED"
  | "ROLE_ASSIGNMENT_NOT_FOUND"
  | "LAST_ACCESS_APPROVER"
  | "IDEMPOTENCY_CONFLICT"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_PENDING"
  | "REQUEST_EXPIRED"
  | "SELF_APPROVAL"
  | "NOT_APPROVER";

export class StaffAccessGovernanceError extends Error {
  constructor(readonly code: StaffAccessErrorCode, message: string) {
    super(message);
    this.name = "StaffAccessGovernanceError";
  }
}

export interface StaffAccessActor {
  staffPrincipalId: string;
  authUserId: string;
}

export interface StaffAccessRequestInput {
  action: StaffAccessAction;
  targetAuthUserId?: string | null;
  targetStaffPrincipalId?: string | null;
  roleId?: string | null;
  displayLabel?: string | null;
  validUntil?: Date | null;
  reason: string;
  idempotencyKey: string;
  actor: StaffAccessActor;
  requestId?: string | null;
}

export interface StaffAccessRequestResult {
  requestId: string;
  action: StaffAccessAction;
  status: "pending" | "approved" | "expired" | "consumed";
  targetAuthUserId: string | null;
  targetStaffPrincipalId: string | null;
  resultStaffPrincipalId: string | null;
  roleId: string | null;
  proposerStaffId: string;
  approverStaffId: string | null;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
  approvedAt: Date | null;
}

async function lockStaffAccessGovernance(db: Database): Promise<void> {
  // Serialize low-volume staff access mutations so concurrent role revocations
  // cannot race the minimum-two-access-approver invariant.
  const [lock] = await db.select({ id: staffAccessGovernanceMutex.id }).from(staffAccessGovernanceMutex)
    .where(eq(staffAccessGovernanceMutex.id, 1))
    .limit(1)
    .for("update");
  if (!lock) throw new StaffAccessGovernanceError("ROLE_NOT_FOUND", "The staff access governance mutex is missing.");
}

async function lockStaffPrincipals(db: Database, principalIds: Array<string | null | undefined>) {
  const ids = [...new Set(principalIds.filter((id): id is string => Boolean(id)))].sort();
  if (ids.length === 0) return [];
  return db.select({
    id: staffPrincipals.id,
    authUserId: staffPrincipals.authUserId,
    status: staffPrincipals.status
  }).from(staffPrincipals)
    .where(inArray(staffPrincipals.id, ids))
    .orderBy(asc(staffPrincipals.id))
    .for("update");
}

async function assertAccessPermission(
  db: Database,
  actor: StaffAccessActor,
  permission: StaffAccessPermission,
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
    throw new StaffAccessGovernanceError("STAFF_INACTIVE", "The staff principal is no longer active.");
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

  if (!grants.some((grant) => grant.permissionKey === permission)) {
    throw new StaffAccessGovernanceError("STAFF_PERMISSION_REVOKED", "The required staff access permission is no longer active.");
  }
}

async function assertRole(db: Database, roleId: string, requireActive = true) {
  const [role] = await db.select({
    id: staffRoles.id,
    roleKey: staffRoles.roleKey,
    status: staffRoles.status
  }).from(staffRoles)
    .where(eq(staffRoles.id, roleId))
    .limit(1)
  if (!role) throw new StaffAccessGovernanceError("ROLE_NOT_FOUND", "The requested staff role does not exist.");
  if (requireActive && role.status !== "active") {
    throw new StaffAccessGovernanceError("ROLE_DISABLED", "The requested staff role is disabled.");
  }
  return role;
}

async function assertNotLastAccessApprover(
  db: Database,
  targetStaffPrincipalId: string,
  now: Date
): Promise<void> {
  const [targetHasApproverRole] = await db.select({
    assignmentId: staffRoleAssignments.id
  }).from(staffRoleAssignments)
    .innerJoin(staffRoles, eq(staffRoleAssignments.roleId, staffRoles.id))
    .where(and(
      eq(staffRoleAssignments.staffPrincipalId, targetStaffPrincipalId),
      eq(staffRoleAssignments.status, "active"),
      isNull(staffRoleAssignments.revokedAt),
      lte(staffRoleAssignments.validFrom, now),
      or(isNull(staffRoleAssignments.validUntil), gt(staffRoleAssignments.validUntil, now)),
      eq(staffRoles.roleKey, "staff_access_approver"),
      eq(staffRoles.status, "active")
    ))
    .limit(1)

  if (!targetHasApproverRole) return;

  const remainingApprovers = await db.select({
    id: staffPrincipals.id
  }).from(staffPrincipals)
    .innerJoin(staffRoleAssignments, eq(staffRoleAssignments.staffPrincipalId, staffPrincipals.id))
    .innerJoin(staffRoles, eq(staffRoleAssignments.roleId, staffRoles.id))
    .where(and(
      eq(staffPrincipals.status, "active"),
      ne(staffPrincipals.id, targetStaffPrincipalId),
      eq(staffRoleAssignments.status, "active"),
      isNull(staffRoleAssignments.revokedAt),
      lte(staffRoleAssignments.validFrom, now),
      or(isNull(staffRoleAssignments.validUntil), gt(staffRoleAssignments.validUntil, now)),
      eq(staffRoles.roleKey, "staff_access_approver"),
      eq(staffRoles.status, "active")
    ))

  if (remainingApprovers.length < 2) {
    throw new StaffAccessGovernanceError("LAST_ACCESS_APPROVER", "This change would leave fewer than two active staff access approvers.");
  }
}

async function validateTarget(
  db: Database,
  input: Pick<StaffAccessRequestInput, "action" | "targetAuthUserId" | "targetStaffPrincipalId" | "roleId" | "displayLabel" | "validUntil" | "actor">,
  now: Date
) {
  if (input.validUntil && (Number.isNaN(input.validUntil.getTime()) || input.validUntil.getTime() <= now.getTime())) {
    throw new StaffAccessGovernanceError("INVALID_INPUT", "Role validity must end in the future.");
  }
  if (input.action !== "provision_principal" && (input.targetAuthUserId || input.displayLabel)) {
    throw new StaffAccessGovernanceError("INVALID_INPUT", "Only principal provisioning accepts an auth user ID or display label.");
  }
  if ((input.action === "revoke_role" || input.action === "suspend_principal" || input.action === "activate_principal") && input.validUntil) {
    throw new StaffAccessGovernanceError("INVALID_INPUT", "This staff access action does not accept a role expiry.");
  }

  if (input.action === "provision_principal") {
    const targetAuthUserId = input.targetAuthUserId?.trim();
    const displayLabel = input.displayLabel?.trim();
    if (!targetAuthUserId || !input.roleId || !displayLabel || displayLabel.length > 120 || input.targetStaffPrincipalId) {
      throw new StaffAccessGovernanceError("INVALID_INPUT", "Provisioning requires an existing auth user, active role, and display label.");
    }
    if (targetAuthUserId === input.actor.authUserId) {
      throw new StaffAccessGovernanceError("SELF_TARGET", "Staff cannot provision themselves.");
    }
    const [targetUser] = await db.select({ id: user.id }).from(user)
      .where(eq(user.id, targetAuthUserId))
      .limit(1);
    if (!targetUser) throw new StaffAccessGovernanceError("TARGET_NOT_FOUND", "The target Better Auth user does not exist.");
    const [existingPrincipal] = await db.select({ id: staffPrincipals.id }).from(staffPrincipals)
      .where(eq(staffPrincipals.authUserId, targetAuthUserId))
      .limit(1)
    if (existingPrincipal) {
      throw new StaffAccessGovernanceError("TARGET_ALREADY_STAFF", "The target auth user already has a staff principal.");
    }
    await assertRole(db, input.roleId);
    return;
  }

  const targetStaffPrincipalId = input.targetStaffPrincipalId;
  if (!targetStaffPrincipalId || targetStaffPrincipalId === input.actor.staffPrincipalId) {
    throw new StaffAccessGovernanceError("SELF_TARGET", "Staff access changes cannot target the acting staff principal.");
  }

  const [target] = await db.select({
    id: staffPrincipals.id,
    status: staffPrincipals.status
  }).from(staffPrincipals)
    .where(eq(staffPrincipals.id, targetStaffPrincipalId))
    .limit(1)
    .for("update");
  if (!target) throw new StaffAccessGovernanceError("TARGET_NOT_FOUND", "The target staff principal does not exist.");

  if (input.action === "suspend_principal") {
    if (input.roleId) throw new StaffAccessGovernanceError("INVALID_INPUT", "Suspension does not accept a role ID.");
    if (target.status !== "active") throw new StaffAccessGovernanceError("PRINCIPAL_NOT_ACTIVE", "Only an active staff principal can be suspended.");
    await assertNotLastAccessApprover(db, targetStaffPrincipalId, now);
    return;
  }
  if (input.action === "activate_principal") {
    if (input.roleId) throw new StaffAccessGovernanceError("INVALID_INPUT", "Reactivation does not accept a role ID.");
    if (target.status !== "suspended") throw new StaffAccessGovernanceError("PRINCIPAL_NOT_SUSPENDED", "Only a suspended staff principal can be reactivated.");
    return;
  }

  if (!input.roleId) throw new StaffAccessGovernanceError("INVALID_INPUT", "A role ID is required for this access change.");
  const role = await assertRole(db, input.roleId, input.action !== "revoke_role");
  if (input.action === "assign_role" && target.status !== "active") {
    throw new StaffAccessGovernanceError("PRINCIPAL_NOT_ACTIVE", "Roles can only be assigned to an active staff principal.");
  }
  const [assignment] = await db.select({
    id: staffRoleAssignments.id
  }).from(staffRoleAssignments)
    .where(and(
      eq(staffRoleAssignments.staffPrincipalId, targetStaffPrincipalId),
      eq(staffRoleAssignments.roleId, input.roleId),
      eq(staffRoleAssignments.status, "active")
    ))
    .limit(1)

  if (input.action === "assign_role" && assignment) {
    throw new StaffAccessGovernanceError("ROLE_ALREADY_ASSIGNED", "The target already has an active assignment for this role.");
  }
  if (input.action === "revoke_role" && !assignment) {
    throw new StaffAccessGovernanceError("ROLE_ASSIGNMENT_NOT_FOUND", "The target has no active assignment for this role.");
  }
  if (input.action === "revoke_role" && role.roleKey === "staff_access_approver") {
    await assertNotLastAccessApprover(db, targetStaffPrincipalId, now);
  }
}

async function appendAccessAudit(
  db: Database,
  input: {
    actorStaffId: string;
    subjectStaffId?: string | null;
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
    subjectStaffId: input.subjectStaffId ?? null,
    action: input.action,
    reason: input.reason,
    requestId: input.requestId ?? null,
    metadata: input.metadata,
    createdAt: input.now
  });
}

function toResult(row: typeof staffAccessChangeRequests.$inferSelect): StaffAccessRequestResult {
  return {
    requestId: row.id,
    action: row.action as StaffAccessAction,
    status: row.status as StaffAccessRequestResult["status"],
    targetAuthUserId: row.targetAuthUserId,
    targetStaffPrincipalId: row.targetStaffPrincipalId,
    resultStaffPrincipalId: row.resultStaffPrincipalId,
    roleId: row.roleId,
    proposerStaffId: row.proposerStaffId,
    approverStaffId: row.approverStaffId,
    reason: row.reason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    approvedAt: row.approvedAt
  };
}

export async function proposeStaffAccessChange(
  db: Database,
  input: StaffAccessRequestInput,
  now = new Date()
): Promise<StaffAccessRequestResult> {
  const reason = input.reason.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!input.action || !reason || reason.length > 1000 || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    throw new StaffAccessGovernanceError("INVALID_INPUT", "Action, reason, and a 16-128 character idempotency key are required.");
  }

  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as Database;
    await lockStaffAccessGovernance(transactionDb);
    await lockStaffPrincipals(transactionDb, [input.actor.staffPrincipalId, input.targetStaffPrincipalId]);
    await assertAccessPermission(transactionDb, input.actor, "bg.staff.access.propose", now);

    const [existing] = await tx.select().from(staffAccessChangeRequests)
      .where(and(
        eq(staffAccessChangeRequests.proposerStaffId, input.actor.staffPrincipalId),
        eq(staffAccessChangeRequests.idempotencyKey, idempotencyKey)
      ))
      .limit(1)
      .for("update");

    if (existing) {
      if (
        existing.action !== input.action ||
        existing.targetAuthUserId !== (input.targetAuthUserId ?? null) ||
        existing.targetStaffPrincipalId !== (input.targetStaffPrincipalId ?? null) ||
        existing.roleId !== (input.roleId ?? null) ||
        existing.displayLabel !== (input.displayLabel?.trim() ?? null) ||
        (existing.validUntil?.getTime() ?? null) !== (input.validUntil?.getTime() ?? null) ||
        existing.reason !== reason
      ) {
        throw new StaffAccessGovernanceError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different staff access request.");
      }
      return toResult(existing);
    }

    await validateTarget(transactionDb, input, now);
    const id = createUuidV7(now.getTime());
    const expiresAt = new Date(now.getTime() + ACCESS_REQUEST_TTL_MS);
    const [created] = await tx.insert(staffAccessChangeRequests).values({
      id,
      action: input.action,
      targetAuthUserId: input.targetAuthUserId ?? null,
      targetStaffPrincipalId: input.targetStaffPrincipalId ?? null,
      roleId: input.roleId ?? null,
      displayLabel: input.displayLabel?.trim() ?? null,
      validUntil: input.validUntil ?? null,
      proposerStaffId: input.actor.staffPrincipalId,
      status: "pending",
      reason,
      idempotencyKey,
      createdAt: now,
      expiresAt
    }).returning();

    if (!created) throw new Error("Staff access request insert returned no row.");
    await appendAccessAudit(transactionDb, {
      actorStaffId: input.actor.staffPrincipalId,
      subjectStaffId: input.targetStaffPrincipalId ?? null,
      action: "bg.staff.access.proposed",
      reason,
      requestId: input.requestId,
      metadata: {
        requestId: id,
        changeAction: input.action,
        targetAuthUserId: input.targetAuthUserId ?? null,
        targetStaffPrincipalId: input.targetStaffPrincipalId ?? null,
        roleId: input.roleId ?? null,
        expiresAt: expiresAt.toISOString()
      },
      now
    });
    return toResult(created);
  });
}

export async function approveStaffAccessChange(
  db: Database,
  input: { requestId: string; reason: string; actor: StaffAccessActor; requestIdHeader?: string | null },
  now = new Date()
): Promise<StaffAccessRequestResult> {
  const reason = input.reason.trim();
  if (!input.requestId || !reason || reason.length > 1000) {
    throw new StaffAccessGovernanceError("INVALID_INPUT", "A request ID and approval reason are required.");
  }

  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as Database;
    await lockStaffAccessGovernance(transactionDb);
    const [reference] = await tx.select({
      proposerStaffId: staffAccessChangeRequests.proposerStaffId,
      targetAuthUserId: staffAccessChangeRequests.targetAuthUserId,
      targetStaffPrincipalId: staffAccessChangeRequests.targetStaffPrincipalId,
      roleId: staffAccessChangeRequests.roleId,
      action: staffAccessChangeRequests.action,
      displayLabel: staffAccessChangeRequests.displayLabel,
      validUntil: staffAccessChangeRequests.validUntil
    }).from(staffAccessChangeRequests)
      .where(eq(staffAccessChangeRequests.id, input.requestId))
      .limit(1);
    if (!reference) throw new StaffAccessGovernanceError("REQUEST_NOT_FOUND", "The staff access request does not exist.");

    const principals = await lockStaffPrincipals(transactionDb, [input.actor.staffPrincipalId, reference.proposerStaffId, reference.targetStaffPrincipalId]);
    const approver = principals.find((principal) => principal.id === input.actor.staffPrincipalId);
    const proposer = principals.find((principal) => principal.id === reference.proposerStaffId);
    if (!approver || approver.authUserId !== input.actor.authUserId || approver.status !== "active" || !proposer || proposer.status !== "active") {
      throw new StaffAccessGovernanceError("STAFF_INACTIVE", "The proposer and approver must both remain active staff principals.");
    }

    await assertAccessPermission(transactionDb, input.actor, "bg.staff.access.approve", now);
    await assertAccessPermission(transactionDb, { staffPrincipalId: proposer.id, authUserId: proposer.authUserId }, "bg.staff.access.propose", now);

    const [request] = await tx.select().from(staffAccessChangeRequests)
      .where(eq(staffAccessChangeRequests.id, input.requestId))
      .limit(1)
      .for("update");
    if (!request) throw new StaffAccessGovernanceError("REQUEST_NOT_FOUND", "The staff access request does not exist.");
    if (request.proposerStaffId !== reference.proposerStaffId || request.targetAuthUserId !== reference.targetAuthUserId || request.targetStaffPrincipalId !== reference.targetStaffPrincipalId || request.roleId !== reference.roleId || request.action !== reference.action || request.displayLabel !== reference.displayLabel || (request.validUntil?.getTime() ?? null) !== (reference.validUntil?.getTime() ?? null)) {
      throw new StaffAccessGovernanceError("REQUEST_NOT_PENDING", "The staff access request binding changed before approval.");
    }
    if (request.proposerStaffId === input.actor.staffPrincipalId) {
      throw new StaffAccessGovernanceError("SELF_APPROVAL", "The proposer cannot approve their own staff access request.");
    }
    if (request.status !== "pending") {
      throw new StaffAccessGovernanceError("REQUEST_NOT_PENDING", "Only a pending staff access request can be approved.");
    }
    if (request.expiresAt.getTime() <= now.getTime()) {
      await tx.update(staffAccessChangeRequests).set({ status: "expired" }).where(eq(staffAccessChangeRequests.id, request.id));
      await appendAccessAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: request.targetStaffPrincipalId,
        action: "bg.staff.access.expired",
        reason: "Staff access request expired before approval.",
        requestId: input.requestIdHeader,
        metadata: { requestId: request.id, changeAction: request.action },
        now
      });
      return toResult({ ...request, status: "expired" });
    }

    await validateTarget(transactionDb, {
      action: request.action as StaffAccessAction,
      targetAuthUserId: request.targetAuthUserId,
      targetStaffPrincipalId: request.targetStaffPrincipalId,
      roleId: request.roleId,
      displayLabel: request.displayLabel,
      validUntil: request.validUntil,
      actor: input.actor
    }, now);

    const [approved] = await tx.update(staffAccessChangeRequests)
      .set({ status: "approved", approverStaffId: input.actor.staffPrincipalId, approvedAt: now })
      .where(and(eq(staffAccessChangeRequests.id, request.id), eq(staffAccessChangeRequests.status, "pending")))
      .returning();
    if (!approved) throw new StaffAccessGovernanceError("REQUEST_NOT_PENDING", "The staff access request was already resolved.");

    await appendAccessAudit(transactionDb, {
      actorStaffId: input.actor.staffPrincipalId,
      subjectStaffId: request.targetStaffPrincipalId,
      action: "bg.staff.access.approved",
      reason,
      requestId: input.requestIdHeader,
      metadata: { requestId: request.id, changeAction: request.action, proposerStaffId: request.proposerStaffId },
      now
    });
    return toResult(approved);
  });
}

export async function executeStaffAccessChange(
  db: Database,
  input: { requestId: string; reason: string; actor: StaffAccessActor; requestIdHeader?: string | null },
  now = new Date()
): Promise<StaffAccessRequestResult> {
  const reason = input.reason.trim();
  if (!input.requestId || !reason || reason.length > 1000) {
    throw new StaffAccessGovernanceError("INVALID_INPUT", "A request ID and execution reason are required.");
  }

  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as Database;
    await lockStaffAccessGovernance(transactionDb);
    const [reference] = await tx.select({
      proposerStaffId: staffAccessChangeRequests.proposerStaffId,
      approverStaffId: staffAccessChangeRequests.approverStaffId,
      targetAuthUserId: staffAccessChangeRequests.targetAuthUserId,
      targetStaffPrincipalId: staffAccessChangeRequests.targetStaffPrincipalId,
      roleId: staffAccessChangeRequests.roleId,
      action: staffAccessChangeRequests.action,
      displayLabel: staffAccessChangeRequests.displayLabel,
      validUntil: staffAccessChangeRequests.validUntil
    }).from(staffAccessChangeRequests)
      .where(eq(staffAccessChangeRequests.id, input.requestId))
      .limit(1);
    if (!reference) throw new StaffAccessGovernanceError("REQUEST_NOT_FOUND", "The staff access request does not exist.");
    if (!reference.approverStaffId) throw new StaffAccessGovernanceError("REQUEST_NOT_PENDING", "The staff access request has not been approved.");
    if (reference.approverStaffId !== input.actor.staffPrincipalId) {
      throw new StaffAccessGovernanceError("NOT_APPROVER", "Only the independent approver may execute this staff access change.");
    }

    const principals = await lockStaffPrincipals(transactionDb, [input.actor.staffPrincipalId, reference.proposerStaffId, reference.targetStaffPrincipalId]);
    const approver = principals.find((principal) => principal.id === input.actor.staffPrincipalId);
    const proposer = principals.find((principal) => principal.id === reference.proposerStaffId);
    if (!approver || approver.authUserId !== input.actor.authUserId || approver.status !== "active" || !proposer || proposer.status !== "active") {
      throw new StaffAccessGovernanceError("STAFF_INACTIVE", "The proposer and approver must both remain active staff principals.");
    }

    await assertAccessPermission(transactionDb, input.actor, "bg.staff.access.approve", now);
    await assertAccessPermission(transactionDb, input.actor, "bg.staff.access.execute", now);
    await assertAccessPermission(transactionDb, { staffPrincipalId: proposer.id, authUserId: proposer.authUserId }, "bg.staff.access.propose", now);

    const [request] = await tx.select().from(staffAccessChangeRequests)
      .where(eq(staffAccessChangeRequests.id, input.requestId))
      .limit(1)
      .for("update");
    if (!request) throw new StaffAccessGovernanceError("REQUEST_NOT_FOUND", "The staff access request does not exist.");
    if (request.proposerStaffId !== reference.proposerStaffId || request.approverStaffId !== reference.approverStaffId || request.targetAuthUserId !== reference.targetAuthUserId || request.targetStaffPrincipalId !== reference.targetStaffPrincipalId || request.roleId !== reference.roleId || request.action !== reference.action || request.displayLabel !== reference.displayLabel || (request.validUntil?.getTime() ?? null) !== (reference.validUntil?.getTime() ?? null)) {
      throw new StaffAccessGovernanceError("REQUEST_NOT_PENDING", "The request binding changed before execution.");
    }
    if (request.status !== "approved" || !request.approvedAt) {
      throw new StaffAccessGovernanceError("REQUEST_NOT_PENDING", "Only an approved, unconsumed staff access request can execute.");
    }
    if (request.approvedAt.getTime() > now.getTime() || now.getTime() - request.approvedAt.getTime() > ACCESS_APPROVAL_TTL_MS) {
      await tx.update(staffAccessChangeRequests)
        .set({ status: "expired", approverStaffId: null, approvedAt: null })
        .where(eq(staffAccessChangeRequests.id, request.id));
      await appendAccessAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: request.targetStaffPrincipalId,
        action: "bg.staff.access.expired",
        reason: "Staff access approval expired before execution.",
        requestId: input.requestIdHeader,
        metadata: { requestId: request.id, changeAction: request.action },
        now
      });
      return toResult({ ...request, status: "expired", approverStaffId: null, approvedAt: null });
    }

    await validateTarget(transactionDb, {
      action: request.action as StaffAccessAction,
      targetAuthUserId: request.targetAuthUserId,
      targetStaffPrincipalId: request.targetStaffPrincipalId,
      roleId: request.roleId,
      displayLabel: request.displayLabel,
      validUntil: request.validUntil,
      actor: input.actor
    }, now);

    let subjectStaffId = request.targetStaffPrincipalId;
    let resultStaffPrincipalId = request.resultStaffPrincipalId;

    if (request.action === "provision_principal") {
      const principalId = createUuidV7(now.getTime());
      await tx.insert(staffPrincipals).values({
        id: principalId,
        authUserId: request.targetAuthUserId!,
        status: "active",
        displayLabel: request.displayLabel!,
        createdAt: now,
        updatedAt: now
      });
      await tx.insert(staffRoleAssignments).values({
        id: createUuidV7(now.getTime()),
        staffPrincipalId: principalId,
        roleId: request.roleId!,
        grantedByStaffId: input.actor.staffPrincipalId,
        status: "active",
        validFrom: now,
        validUntil: request.validUntil,
        createdAt: now
      });
      subjectStaffId = principalId;
      resultStaffPrincipalId = principalId;
      await appendAccessAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: principalId,
        action: "bg.staff.principal.provisioned",
        reason,
        requestId: input.requestIdHeader,
        metadata: { requestId: request.id, authUserId: request.targetAuthUserId, roleId: request.roleId },
        now
      });
    } else if (request.action === "assign_role") {
      await tx.insert(staffRoleAssignments).values({
        id: createUuidV7(now.getTime()),
        staffPrincipalId: request.targetStaffPrincipalId!,
        roleId: request.roleId!,
        grantedByStaffId: input.actor.staffPrincipalId,
        status: "active",
        validFrom: now,
        validUntil: request.validUntil,
        createdAt: now
      });
      await appendAccessAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: request.targetStaffPrincipalId,
        action: "bg.staff.role.assigned",
        reason,
        requestId: input.requestIdHeader,
        metadata: { requestId: request.id, roleId: request.roleId },
        now
      });
    } else if (request.action === "revoke_role") {
      const [assignment] = await tx.select({ id: staffRoleAssignments.id })
        .from(staffRoleAssignments)
        .where(and(
          eq(staffRoleAssignments.staffPrincipalId, request.targetStaffPrincipalId!),
          eq(staffRoleAssignments.roleId, request.roleId!),
          eq(staffRoleAssignments.status, "active")
        ))
        .limit(1)
      if (!assignment) throw new StaffAccessGovernanceError("ROLE_ASSIGNMENT_NOT_FOUND", "The role assignment is no longer active.");
      await tx.update(staffRoleAssignments)
        .set({ status: "revoked", revokedAt: now })
        .where(eq(staffRoleAssignments.id, assignment.id));
      await appendAccessAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: request.targetStaffPrincipalId,
        action: "bg.staff.role.revoked",
        reason,
        requestId: input.requestIdHeader,
        metadata: { requestId: request.id, roleId: request.roleId, assignmentId: assignment.id },
        now
      });
    } else if (request.action === "suspend_principal") {
      const [suspended] = await tx.update(staffPrincipals)
        .set({ status: "suspended", updatedAt: now })
        .where(and(
          eq(staffPrincipals.id, request.targetStaffPrincipalId!),
          eq(staffPrincipals.status, "active")
        ))
        .returning({ id: staffPrincipals.id });
      if (!suspended) throw new StaffAccessGovernanceError("PRINCIPAL_NOT_ACTIVE", "The target principal is no longer active.");
      await appendAccessAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: request.targetStaffPrincipalId,
        action: "bg.staff.principal.suspended",
        reason,
        requestId: input.requestIdHeader,
        metadata: { requestId: request.id },
        now
      });
    } else {
      const [activated] = await tx.update(staffPrincipals)
        .set({ status: "active", updatedAt: now })
        .where(and(
          eq(staffPrincipals.id, request.targetStaffPrincipalId!),
          eq(staffPrincipals.status, "suspended")
        ))
        .returning({ id: staffPrincipals.id });
      if (!activated) throw new StaffAccessGovernanceError("PRINCIPAL_NOT_SUSPENDED", "The target principal is no longer suspended.");
      await appendAccessAudit(transactionDb, {
        actorStaffId: input.actor.staffPrincipalId,
        subjectStaffId: request.targetStaffPrincipalId,
        action: "bg.staff.principal.activated",
        reason,
        requestId: input.requestIdHeader,
        metadata: { requestId: request.id },
        now
      });
    }

    const [consumed] = await tx.update(staffAccessChangeRequests)
      .set({
        status: "consumed",
        consumedAt: now,
        resultStaffPrincipalId
      })
      .where(and(eq(staffAccessChangeRequests.id, request.id), eq(staffAccessChangeRequests.status, "approved")))
      .returning();
    if (!consumed) throw new StaffAccessGovernanceError("REQUEST_NOT_PENDING", "The staff access request was already consumed.");

    await appendAccessAudit(transactionDb, {
      actorStaffId: input.actor.staffPrincipalId,
      subjectStaffId,
      action: "bg.staff.access.executed",
      reason,
      requestId: input.requestIdHeader,
      metadata: {
        requestId: request.id,
        changeAction: request.action,
        targetStaffPrincipalId: subjectStaffId,
        roleId: request.roleId,
        resultStaffPrincipalId
      },
      now
    });
    return toResult(consumed);
  });
}
