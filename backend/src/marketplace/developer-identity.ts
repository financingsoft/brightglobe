import type { BetterAuthInstance } from "../auth.js";
import type { Database } from "../db/client.js";
import { resolveCanonicalAuth } from "../middleware/require-canonical-auth.js";

/** Resolve only server-validated sessions; never accept a client-supplied user ID. */
export async function resolveDeveloperRequestIdentity(
  db: Database,
  auth: BetterAuthInstance,
  request: Request
) {
  const result = await resolveCanonicalAuth(db, auth, request);
  if (!result.ok) return null;
  return {
    canonicalUserId: result.identity.canonicalUserId,
    verifiedEmail: result.identity.source === "email" ? result.identity.email : null,
    displayName: result.identity.displayName
  };
}
