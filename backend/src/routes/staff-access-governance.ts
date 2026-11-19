import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { BetterAuthInstance } from "../auth.js";
import type { Database } from "../db/client.js";
import { staffAccessChangeRequests, staffPrincipals, staffRoles } from "../db/schema.js";
import {
  approveStaffAccessChange,
  executeStaffAccessChange,
  proposeStaffAccessChange,
  StaffAccessGovernanceError,
  type StaffAccessAction
} from "../auth/staff-access-governance.js";
import {
  createRequireStaffPermission,
  createRequireStaffPermissionWithStepUp,
  type StaffAuthVariables
} from "../middleware/require-staff-permission.js";

function normalizeAccessError(error: unknown): {
  status: 400 | 403 | 404 | 409 | 410;
  code: string;
  message: string;
} | null {
  if (!(error instanceof StaffAccessGovernanceError)) return null;
  const status: 400 | 403 | 404 | 409 | 410 =
    error.code === "INVALID_INPUT" ? 400
      : error.code === "STAFF_INACTIVE" ||
        error.code === "STAFF_PERMISSION_REVOKED" ||
        error.code === "SELF_TARGET" ||
        error.code === "SELF_APPROVAL" ||
        error.code === "NOT_APPROVER" ? 403
      : error.code === "TARGET_NOT_FOUND" ||
        error.code === "ROLE_NOT_FOUND" ||
        error.code === "REQUEST_NOT_FOUND" ? 404
      : error.code === "REQUEST_EXPIRED" ? 410
      : 409;
  return { status, code: error.code, message: error.message };
}

export function createStaffAccessGovernanceRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono<{ Variables: StaffAuthVariables }>();

  routes.get(
    "/roles",
    createRequireStaffPermission(db, auth, "bg.staff.access.read"),
    async (context) => {
      const roles = await db.select({
        id: staffRoles.id,
        roleKey: staffRoles.roleKey,
        displayName: staffRoles.displayName,
        description: staffRoles.description
      }).from(staffRoles)
        .where(eq(staffRoles.status, "active"))
        .orderBy(staffRoles.roleKey);
      return context.json({ roles });
    }
  );

  routes.get(
    "/principals",
    createRequireStaffPermission(db, auth, "bg.staff.access.read"),
    async (context) => {
      const principals = await db.select({
        id: staffPrincipals.id,
        displayLabel: staffPrincipals.displayLabel,
        status: staffPrincipals.status,
        createdAt: staffPrincipals.createdAt,
        updatedAt: staffPrincipals.updatedAt
      }).from(staffPrincipals)
        .orderBy(desc(staffPrincipals.createdAt))
        .limit(100);
      return context.json({ principals });
    }
  );

  routes.get(
    "/requests",
    createRequireStaffPermission(db, auth, "bg.staff.access.read"),
    async (context) => {
      const status = context.req.query("status");
      const allowed = new Set(["pending", "approved", "expired", "consumed"]);
      if (status && !allowed.has(status)) {
        return context.json({ error: { code: "INVALID_STATUS_FILTER", message: "Unsupported request status filter." } }, 400);
      }
      const filters = [];
      if (status) filters.push(eq(staffAccessChangeRequests.status, status));
      const requests = await db.select().from(staffAccessChangeRequests)
        .where(and(...filters))
        .orderBy(desc(staffAccessChangeRequests.createdAt))
        .limit(100);
      return context.json({ requests });
    }
  );

  routes.get(
    "/requests/:requestId",
    createRequireStaffPermission(db, auth, "bg.staff.access.read"),
    async (context) => {
      const [request] = await db.select().from(staffAccessChangeRequests)
        .where(eq(staffAccessChangeRequests.id, context.req.param("requestId")))
        .limit(1);
      if (!request) {
        return context.json({ error: { code: "REQUEST_NOT_FOUND", message: "The staff access request does not exist." } }, 404);
      }
      return context.json({ request });
    }
  );

  routes.post(
    "/requests",
    createRequireStaffPermissionWithStepUp(db, auth, "bg.staff.access.propose"),
    async (context) => {
      const body = await context.req.json().catch(() => null) as Record<string, unknown> | null;
      const actions = new Set<StaffAccessAction>(["provision_principal", "assign_role", "revoke_role", "suspend_principal"]);
      if (
        !body ||
        typeof body.action !== "string" ||
        !actions.has(body.action as StaffAccessAction) ||
        typeof body.reason !== "string" ||
        typeof body.idempotencyKey !== "string"
      ) {
        return context.json({
          error: { code: "INVALID_INPUT", message: "A supported action, reason, and idempotency key are required." }
        }, 400);
      }

      let validUntil: Date | null = null;
      if (body.validUntil !== undefined && body.validUntil !== null) {
        if (typeof body.validUntil !== "string") {
          return context.json({ error: { code: "INVALID_INPUT", message: "validUntil must be an ISO date string." } }, 400);
        }
        validUntil = new Date(body.validUntil);
        if (Number.isNaN(validUntil.getTime())) {
          return context.json({ error: { code: "INVALID_INPUT", message: "validUntil must be a valid ISO date string." } }, 400);
        }
      }

      try {
        const staff = context.get("staffAuth");
        const request = await proposeStaffAccessChange(db, {
          action: body.action as StaffAccessAction,
          targetAuthUserId: typeof body.targetAuthUserId === "string" ? body.targetAuthUserId.trim() : null,
          targetStaffPrincipalId: typeof body.targetStaffPrincipalId === "string" ? body.targetStaffPrincipalId.trim() : null,
          roleId: typeof body.roleId === "string" ? body.roleId.trim() : null,
          displayLabel: typeof body.displayLabel === "string" ? body.displayLabel.trim() : null,
          validUntil,
          reason: body.reason,
          idempotencyKey: body.idempotencyKey,
          actor: { staffPrincipalId: staff.staffPrincipalId, authUserId: staff.authUserId },
          requestId: context.req.header("x-request-id") ?? context.req.header("cf-ray")
        });
        return context.json({ request }, 201);
      } catch (error) {
        const failure = normalizeAccessError(error);
        if (!failure) throw error;
        return context.json({ error: { code: failure.code, message: failure.message } }, failure.status);
      }
    }
  );

  routes.post(
    "/requests/:requestId/approve",
    createRequireStaffPermissionWithStepUp(db, auth, "bg.staff.access.approve"),
    async (context) => {
      const body = await context.req.json().catch(() => null) as { reason?: unknown } | null;
      if (!body || typeof body.reason !== "string") {
        return context.json({ error: { code: "INVALID_INPUT", message: "An approval reason is required." } }, 400);
      }
      try {
        const staff = context.get("staffAuth");
        const request = await approveStaffAccessChange(db, {
          requestId: context.req.param("requestId"),
          reason: body.reason,
          actor: { staffPrincipalId: staff.staffPrincipalId, authUserId: staff.authUserId },
          requestIdHeader: context.req.header("x-request-id") ?? context.req.header("cf-ray")
        });
        return context.json({ request });
      } catch (error) {
        const failure = normalizeAccessError(error);
        if (!failure) throw error;
        return context.json({ error: { code: failure.code, message: failure.message } }, failure.status);
      }
    }
  );

  routes.post(
    "/requests/:requestId/execute",
    createRequireStaffPermissionWithStepUp(db, auth, "bg.staff.access.execute"),
    async (context) => {
      const body = await context.req.json().catch(() => null) as { reason?: unknown } | null;
      if (!body || typeof body.reason !== "string") {
        return context.json({ error: { code: "INVALID_INPUT", message: "An execution reason is required." } }, 400);
      }
      try {
        const staff = context.get("staffAuth");
        const request = await executeStaffAccessChange(db, {
          requestId: context.req.param("requestId"),
          reason: body.reason,
          actor: { staffPrincipalId: staff.staffPrincipalId, authUserId: staff.authUserId },
          requestIdHeader: context.req.header("x-request-id") ?? context.req.header("cf-ray")
        });
        return context.json({ request });
      } catch (error) {
        const failure = normalizeAccessError(error);
        if (!failure) throw error;
        return context.json({ error: { code: failure.code, message: failure.message } }, failure.status);
      }
    }
  );

  return routes;
}
