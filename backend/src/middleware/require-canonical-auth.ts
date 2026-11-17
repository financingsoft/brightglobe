import { and, eq, gt, isNull } from "drizzle-orm";
import type { BetterAuthInstance } from "../auth.js";
import type { Database } from "../db/client.js";
import { canonicalUsers, providerIdentities, walletSessions } from "../db/schema.js";
import { provisionCanonicalIdentity } from "../identity/identity-service.js";
import { hashWalletSessionToken } from "../auth/wallet/service.js";
import { isSyntheticPhoneEmail } from "../domain/phone.js";
import { readWalletSessionCredential } from "../auth/wallet/cookie.js";

export interface CanonicalAuthContext {
  canonicalUserId: string;
  source: "email" | "wallet";
  email: string | null;
  displayName: string;
  walletSessionId?: string;
}

export type CanonicalAuthVariables = { canonicalAuth: CanonicalAuthContext };

export type CanonicalAuthResolution =
  | { ok: true; identity: CanonicalAuthContext }
  | {
      ok: false;
      status: 401 | 403 | 409;
      error: { code: string; message: string };
    };

/**
 * Resolve Better Auth and wallet sessions into the canonical UUIDv7 identity.
 * This is the single identity-resolution implementation shared by the
 * existing backend middleware and the isolated Marketplace private Worker.
 */
export async function resolveCanonicalAuth(
  db: Database,
  auth: BetterAuthInstance,
  request: Request
): Promise<CanonicalAuthResolution> {
  const emailSession = await auth.api.getSession({ headers: request.headers });
  if (emailSession) {
    if (isSyntheticPhoneEmail(emailSession.user.email)) {
      return {
        ok: false,
        status: 403,
        error: {
          code: "EMAIL_IDENTITY_REQUIRED",
          message: "Phone-only sessions cannot be provisioned as email identities. Link a verified email or sign in with a wallet."
        }
      };
    }
    if (!emailSession.user.emailVerified) {
      return {
        ok: false,
        status: 403,
        error: { code: "EMAIL_NOT_VERIFIED", message: "Verify your email before using this feature." }
      };
    }

    const [emailIdentity] = await db.select({ id: providerIdentities.id })
      .from(providerIdentities)
      .where(and(
        eq(providerIdentities.provider, "better_auth_email"),
        eq(providerIdentities.providerSubject, emailSession.user.id)
      ))
      .limit(1);

    if (!emailIdentity) {
      const walletToken = readWalletSessionCredential(
        request.headers.get("Cookie"),
        request.headers.get("Authorization")
      );
      if (walletToken) {
        const walletTokenHash = await hashWalletSessionToken(walletToken);
        const now = new Date();
        const [activeWalletSession] = await db.select({ id: walletSessions.id })
          .from(walletSessions)
          .innerJoin(canonicalUsers, eq(walletSessions.canonicalUserId, canonicalUsers.id))
          .where(and(
            eq(walletSessions.tokenHash, walletTokenHash),
            isNull(walletSessions.revokedAt),
            gt(walletSessions.expiresAt, now),
            eq(canonicalUsers.status, "active")
          ))
          .limit(1);
        if (activeWalletSession) {
          return {
            ok: false,
            status: 409,
            error: {
              code: "IDENTITY_LINK_REQUIRED",
              message: "A wallet session and an unlinked email session are both present. Explicitly link these identities before using canonical account features."
            }
          };
        }
      }
    }

    const canonical = await provisionCanonicalIdentity(db, {
      provider: "better_auth_email",
      providerSubject: emailSession.user.id,
      verifiedAt: new Date()
    });
    return {
      ok: true,
      identity: {
        canonicalUserId: canonical.id,
        source: "email",
        email: emailSession.user.email,
        displayName: emailSession.user.name
      }
    };
  }

  const token = readWalletSessionCredential(
    request.headers.get("Cookie"),
    request.headers.get("Authorization")
  );
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." }
    };
  }

  const tokenHash = await hashWalletSessionToken(token);
  const now = new Date();
  const [record] = await db.select({
    session: walletSessions,
    user: canonicalUsers
  })
    .from(walletSessions)
    .innerJoin(canonicalUsers, eq(walletSessions.canonicalUserId, canonicalUsers.id))
    .where(and(
      eq(walletSessions.tokenHash, tokenHash),
      isNull(walletSessions.revokedAt),
      gt(walletSessions.expiresAt, now),
      eq(canonicalUsers.status, "active")
    ))
    .limit(1);

  if (!record) {
    return {
      ok: false,
      status: 401,
      error: { code: "UNAUTHORIZED", message: "The wallet session is invalid or expired." }
    };
  }

  await db.update(walletSessions)
    .set({ lastSeenAt: now })
    .where(eq(walletSessions.id, record.session.id));

  return {
    ok: true,
    identity: {
      canonicalUserId: record.user.id,
      source: "wallet",
      email: null,
      displayName: "BrightGlobe member",
      walletSessionId: record.session.id
    }
  };
}

export function createRequireCanonicalAuth(db: Database, auth: BetterAuthInstance) {
  return createMiddleware<{ Variables: CanonicalAuthVariables }>(async (context, next) => {
    const result = await resolveCanonicalAuth(db, auth, context.req.raw);
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }
    context.set("canonicalAuth", result.identity);
    await next();
  });
}
