import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  staffPrincipals,
  staffRoleAssignments,
  staffRolePermissions,
  staffRoles,
  staffPermissions
} from "../db/schema.js";

export type StaffPermission =
  | "bg.treasury.read"
  | "bg.treasury.recovery.propose"
  | "bg.treasury.recovery.approve"
  | "bg.treasury.recovery.execute"
  | "bg.staff.access.read"
  | "bg.staff.access.propose"
  | "bg.staff.access.approve"
  | "bg.staff.access.execute"
  | "bg.rewards.evidence.review"
  | "bg.rewards.appeal.review";

export interface StaffAuthorization {
  staffPrincipalId: string;
  authUserId: string;
  permissions: ReadonlySet<string>;
}

export type StaffAuthorizationResult =
  | { ok: true; staff: StaffAuthorization }
  | { ok: false; reason: "NOT_STAFF" | "STAFF_INACTIVE" };

export async function resolveStaffAuthorization(
  db: Database,
  authUserId: string,
  now = new Date()
): Promise<StaffAuthorizationResult> {
  if (!authUserId || Number.isNaN(now.getTime())) {
    return { ok: false, reason: "NOT_STAFF" };
  }

  const [principal] = await db.select({
    id: staffPrincipals.id,
    status: staffPrincipals.status
  }).from(staffPrincipals)
    .where(eq(staffPrincipals.authUserId, authUserId))
    .limit(1);

  if (!principal) return { ok: false, reason: "NOT_STAFF" };
  if (principal.status !== "active") return { ok: false, reason: "STAFF_INACTIVE" };

  const grants = await db.select({
    permissionKey: staffPermissions.permissionKey
  }).from(staffRoleAssignments)
    .innerJoin(staffRoles, eq(staffRoleAssignments.roleId, staffRoles.id))
    .innerJoin(staffRolePermissions, eq(staffRolePermissions.roleId, staffRoles.id))
    .innerJoin(staffPermissions, eq(staffRolePermissions.permissionId, staffPermissions.id))
    .where(and(
      eq(staffRoleAssignments.staffPrincipalId, principal.id),
      eq(staffRoleAssignments.status, "active"),
      lte(staffRoleAssignments.validFrom, now),
      or(isNull(staffRoleAssignments.validUntil), gt(staffRoleAssignments.validUntil, now)),
      isNull(staffRoleAssignments.revokedAt),
      eq(staffRoles.status, "active")
    ));

  return {
    ok: true,
    staff: {
      staffPrincipalId: principal.id,
      authUserId,
      permissions: new Set(grants.map((grant) => grant.permissionKey))
    }
  };
}

export async function staffHasPermission(
  db: Database,
  authUserId: string,
  permission: string,
  now = new Date()
): Promise<boolean> {
  const result = await resolveStaffAuthorization(db, authUserId, now);
  return result.ok && result.staff.permissions.has(permission);
}
