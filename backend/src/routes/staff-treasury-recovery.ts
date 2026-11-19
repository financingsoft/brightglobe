import { Hono } from "hono";
import type { BetterAuthInstance } from "../auth.js";
import type { Database } from "../db/client.js";
import {
  approveBgTreasuryRecovery,
  proposeBgTreasuryRecovery,
  TreasuryRecoveryWorkflowError
} from "../rewards/bg-treasury-recovery-workflow.js";
import {
  createRequireStaffPermissionWithStepUp,
  type StaffAuthVariables
} from "../middleware/require-staff-permission.js";

function errorResponse(error: unknown, context: Parameters<Parameters<Hono<{ Variables: StaffAuthVariables }>["post"]>[1]>[0]) {
  if (!(error instanceof TreasuryRecoveryWorkflowError)) throw error;

  const status = error.code === "INVALID_INPUT" ? 400
    : error.code === "STAFF_INACTIVE" || error.code === "STAFF_PERMISSION_REVOKED" ? 403
    : error.code === "TREASURY_NOT_FOUND" || error.code === "PROPOSAL_NOT_FOUND" ? 404
    : error.code === "PROPOSAL_EXPIRED" ? 410
    : 409;

  return context.json({
    error: { code: error.code, message: error.message }
  }, status);
}

export function createStaffTreasuryRecoveryRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono<{ Variables: StaffAuthVariables }>();

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
        return errorResponse(error, context);
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
        return errorResponse(error, context);
      }
    }
  );

  return routes;
}
