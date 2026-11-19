import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { BetterAuthInstance } from "../auth.js";
import { resolveStaffAuthorization } from "../auth/staff-authorization.js";
import { issueStaffStepUpGrant, type StaffStepUpOperation } from "../auth/staff-step-up.js";
import type { Database } from "../db/client.js";
import { twoFactor, user } from "../db/schema.js";

const operations = new Set<StaffStepUpOperation>([
  "bg.treasury.recovery.propose",
  "bg.treasury.recovery.approve",
  "bg.treasury.recovery.execute"
]);

export function createStaffStepUpRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono();

  routes.post("/", async (context) => {
    const body = await context.req.json().catch(() => null) as {
      code?: unknown;
      operation?: unknown;
    } | null;

    if (
      !body ||
      typeof body.code !== "string" ||
      !/^\d{6}$/.test(body.code) ||
      typeof body.operation !== "string" ||
      !operations.has(body.operation as StaffStepUpOperation)
    ) {
      return context.json({
        error: { code: "INVALID_STEP_UP_REQUEST", message: "A valid TOTP code and supported operation are required." }
      }, 400);
    }

    const session = await auth.api.getSession({ headers: context.req.raw.headers });
    if (!session?.session.id) {
      return context.json({
        error: { code: "STAFF_AUTH_REQUIRED", message: "A valid staff sign-in is required." }
      }, 401);
    }

    const operation = body.operation as StaffStepUpOperation;
    const resolved = await resolveStaffAuthorization(db, session.user.id);
    if (!resolved.ok) {
      return context.json({
        error: {
          code: resolved.reason === "STAFF_INACTIVE" ? "STAFF_INACTIVE" : "STAFF_FORBIDDEN",
          message: "The authenticated account is not an active BrightGlobe staff principal."
        }
      }, 403);
    }

    if (!resolved.staff.permissions.has(operation)) {
      return context.json({
        error: { code: "STAFF_PERMISSION_REQUIRED", message: "The staff account lacks the required permission." }
      }, 403);
    }

    const [authUser] = await db.select({ twoFactorEnabled: user.twoFactorEnabled })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    const [factor] = await db.select({ verified: twoFactor.verified })
      .from(twoFactor)
      .where(eq(twoFactor.userId, session.user.id))
      .limit(1);

    if (!authUser?.twoFactorEnabled || !factor?.verified) {
      return context.json({
        error: { code: "STAFF_TOTP_ENROLLMENT_REQUIRED", message: "An enrolled and verified authenticator is required." }
      }, 403);
    }

    try {
      await auth.api.verifyTOTP({
        body: { code: body.code, trustDevice: false },
        headers: context.req.raw.headers
      });
    } catch {
      return context.json({
        error: { code: "STAFF_TOTP_VERIFICATION_FAILED", message: "The authenticator code could not be verified." }
      }, 401);
    }

    const grant = await issueStaffStepUpGrant(db, {
      staffPrincipalId: resolved.staff.staffPrincipalId,
      authUserId: resolved.staff.authUserId,
      sessionId: session.session.id,
      operation
    });

    context.header("Cache-Control", "no-store");
    return context.json({
      operation,
      token: grant.token,
      expiresAt: grant.expiresAt.toISOString(),
      singleUse: true
    }, 201);
  });

  return routes;
}
