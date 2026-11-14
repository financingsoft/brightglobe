import { createMiddleware } from "hono/factory";
import type { BetterAuthInstance } from "../auth.js";

export type AuthSession = NonNullable<Awaited<ReturnType<BetterAuthInstance["api"]["getSession"]>>>;
export type AuthVariables = { authSession: AuthSession };

export function createRequireAuth(auth: BetterAuthInstance) {
  return createMiddleware<{ Variables: AuthVariables }>(async (context, next) => {
    const current = await auth.api.getSession({ headers: context.req.raw.headers });
    if (!current) {
      return context.json({
        error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." }
      }, 401);
    }
    context.set("authSession", current);
    await next();
  });
}
