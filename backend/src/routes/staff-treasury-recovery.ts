import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { BetterAuthInstance } from "../auth.js";
import type { Database } from "../db/client.js";
import { bgTreasuryRecoveryProposals } from "../db/schema.js";
import {
  approveBgTreasuryRecovery,
  executeBgTreasuryRecovery,
  proposeBgTreasuryRecovery,
  TreasuryRecoveryWorkflowError
} from "../rewards/bg-treasury-recovery-workflow.js";
import {
  createRequireStaffPermission,
  createRequireStaffPermissionWithStepUp,
  type StaffAuthVariables
} from "../middleware/require-staff-permission.js";

function normalizeWorkflowError(error: unknown): {
  status: 400 | 403 | 404 | 409 | 410;
  code: string;
  message: string;
} | null {
  if (!(error instanceof TreasuryRecoveryWorkflowError)) return null;

  const status: 400 | 403 | 404 | 409 | 410 = error.code === "INVALID_INPUT" ? 400
    : error.code === "STAFF_INACTIVE" || error.code === "STAFF_PERMISSION_REVOKED" || error.code === "NOT_APPROVER" ? 403
    : error.code === "TREASURY_NOT_FOUND" || error.code === "PROPOSAL_NOT_FOUND" ? 404
    : error.code === "PROPOSAL_EXPIRED" ? 410
    : 409;
  return { status, code: error.code, message: error.message };
}

export function createStaffTreasuryRecoveryRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono<{ Variables: StaffAuthVariables }>();

  routes.get(
    "/proposals",
    createRequireStaffPermission(db, auth, "bg.treasury.read"),
    async (context) => {
      const treasuryAccountId = context.req.query("treasuryAccountId");
      const status = context.req.query("status");
      const allowedStatuses = new Set(["pending", "approved", "expired", "consumed"]);
      if (status && !allowedStatuses.has(status)) {
        return context.json({
          error: { code: "INVALID_STATUS_FILTER", message: "The proposal status filter is not supported." }
        }, 400);
      }

      const filters = [];
      if (treasuryAccountId) filters.push(eq(bgTreasuryRecoveryProposals.treasuryAccountId, treasuryAccountId));
      if (status) filters.push(eq(bgTreasuryRecoveryProposals.status, status));
      const proposals = await db.select().from(bgTreasuryRecoveryProposals)
        .where(and(...filters))
        .orderBy(desc(bgTreasuryRecoveryProposals.createdAt))
        .limit(50);
      return context.json({ proposals });
    }
  );

  routes.get(
    "/proposals/:proposalId",
    createRequireStaffPermission(db, auth, "bg.treasury.read"),
    async (context) => {
      const [proposal] = await db.select().from(bgTreasuryRecoveryProposals)
        .where(eq(bgTreasuryRecoveryProposals.id, context.req.param("proposalId")))
        .limit(1);
      if (!proposal) {
        return context.json({
          error: { code: "PROPOSAL_NOT_FOUND", message: "The Treasury recovery proposal does not exist." }
        }, 404);
      }
      return context.json({ proposal });
    }
  );

  routes.post(
    "/proposals",
    createRequireStaffPermissionWithStepUp(db, auth, "bg.treasury.recovery.propose"),
    async (context) => {
      const body = await context.req.json().catch(() => null) as {
        treasuryAccountId?: unknown;
        snapshotId?: unknown;
        reason?: unknown;
        idempotencyKey?: unknown;
      } | null;

      if (
        !body ||
        typeof body.treasuryAccountId !== "string" ||
        typeof body.snapshotId !== "string" ||
        typeof body.reason !== "string" ||
        typeof body.idempotencyKey !== "string"
      ) {
        return context.json({
          error: { code: "INVALID_INPUT", message: "Treasury, snapshot, reason, and idempotency key are required." }
        }, 400);
      }

      try {
        const staff = context.get("staffAuth");
        const proposal = await proposeBgTreasuryRecovery(db, {
          treasuryAccountId: body.treasuryAccountId,
          snapshotId: body.snapshotId,
          reason: body.reason,
          idempotencyKey: body.idempotencyKey,
          actor: { staffPrincipalId: staff.staffPrincipalId, authUserId: staff.authUserId },
          requestId: context.req.header("x-request-id") ?? context.req.header("cf-ray")
        });
        return context.json({ proposal }, 201);
      } catch (error) {
        const failure = normalizeWorkflowError(error);
        if (!failure) throw error;
        return context.json({ error: { code: failure.code, message: failure.message } }, failure.status);
      }
    }
  );

  routes.post(
    "/proposals/:proposalId/approve",
    createRequireStaffPermissionWithStepUp(db, auth, "bg.treasury.recovery.approve"),
    async (context) => {
      const body = await context.req.json().catch(() => null) as { reason?: unknown } | null;
      if (!body || typeof body.reason !== "string") {
        return context.json({
          error: { code: "INVALID_INPUT", message: "An approval reason is required." }
        }, 400);
      }

      try {
        const staff = context.get("staffAuth");
        const proposal = await approveBgTreasuryRecovery(db, {
          proposalId: context.req.param("proposalId"),
          reason: body.reason,
          actor: { staffPrincipalId: staff.staffPrincipalId, authUserId: staff.authUserId },
          requestId: context.req.header("x-request-id") ?? context.req.header("cf-ray")
        });
        return context.json({ proposal });
      } catch (error) {
        const failure = normalizeWorkflowError(error);
        if (!failure) throw error;
        return context.json({ error: { code: failure.code, message: failure.message } }, failure.status);
      }
    }
  );

  routes.post(
    "/proposals/:proposalId/execute",
    createRequireStaffPermissionWithStepUp(db, auth, "bg.treasury.recovery.execute"),
    async (context) => {
      const body = await context.req.json().catch(() => null) as { reason?: unknown } | null;
      if (!body || typeof body.reason !== "string") {
        return context.json({
          error: { code: "INVALID_INPUT", message: "An execution reason is required." }
        }, 400);
      }

      try {
        const staff = context.get("staffAuth");
        const proposal = await executeBgTreasuryRecovery(db, {
          proposalId: context.req.param("proposalId"),
          reason: body.reason,
          actor: { staffPrincipalId: staff.staffPrincipalId, authUserId: staff.authUserId },
          requestId: context.req.header("x-request-id") ?? context.req.header("cf-ray")
        });
        return context.json({ proposal, treasuryStatus: "active" });
      } catch (error) {
        const failure = normalizeWorkflowError(error);
        if (!failure) throw error;
        return context.json({ error: { code: failure.code, message: failure.message } }, failure.status);
      }
    }
  );

  return routes;
}
