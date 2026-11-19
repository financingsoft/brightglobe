import { createMiddleware } from "hono/factory";
import type { BetterAuthInstance } from "../auth.js";
import type { Database } from "../db/client.js";
import { resolveStaffAuthorization, type StaffPermission } from "../auth/staff-authorization.js";

export interface StaffAuthContext {
  staffPrincipalId: string;
  authUserId: string;
  permissions: ReadonlySet<string>;
}

export type StaffAuthVariables = { staffAuth: StaffAuthContext };

/**
 * Staff authorization is derived only from the authenticated Better Auth user
 * and active database grants. No request header, body, role claim, or canonical
 * member identity can grant staff permissions.
 */
export function createRequireStaffPermission(
  db: Database,
  auth: BetterAuthInstance,
  permission: StaffPermission
) {
  return createMiddleware<{ Variables: StaffAuthVariables }>(async (context, next) => {
    const session = await auth.api.getSession({ headers: context.req.raw.headers });
    if (!session) {
      return context.json({
        error: { code: "STAFF_AUTH_REQUIRED", message: "A valid staff sign-in is required." }
      }, 401);
    }

    const resolved = await resolveStaffAuthorization(db, session.user.id);
    if (!resolved.ok) {
      return context.json({
        error: {
          code: resolved.reason === "STAFF_INACTIVE" ? "STAFF_INACTIVE" : "STAFF_FORBIDDEN",
          message: "The authenticated account is not an active BrightGlobe staff principal."
        }
      }, 403);
    }

    if (!resolved.staff.permissions.has(permission)) {
      return context.json({
        error: { code: "STAFF_PERMISSION_REQUIRED", message: "The staff account lacks the required permission." }
      }, 403);
    }

    context.set("staffAuth", resolved.staff);
    await next();
  });
}
