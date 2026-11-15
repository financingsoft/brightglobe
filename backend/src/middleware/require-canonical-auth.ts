import { and, eq, gt, isNull } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { BetterAuthInstance } from "../auth.js";
import type { Database } from "../db/client.js";
import { canonicalUsers, providerIdentities, walletSessions } from "../db/schema.js";
import { provisionCanonicalIdentity } from "../identity/identity-service.js";
import { hashWalletSessionToken } from "../auth/wallet/service.js";
import { readWalletSessionCredential } from "../auth/wallet/cookie.js";

export interface CanonicalAuthContext {
  canonicalUserId: string;
  source: "email" | "wallet";
  email: string | null;
  displayName: string;
  walletSessionId?: string;
}

export type CanonicalAuthVariables = { canonicalAuth: CanonicalAuthContext };

export function createRequireCanonicalAuth(db: Database, auth: BetterAuthInstance) {
  return createMiddleware<{ Variables: CanonicalAuthVariables }>(async (context, next) => {
    const emailSession = await auth.api.getSession({ headers: context.req.raw.headers });
    if (emailSession) {
      if (!emailSession.user.emailVerified) {
        return context.json({
          error: { code: "EMAIL_NOT_VERIFIED", message: "Verify your email before using this feature." }
        }, 403);
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
          context.req.header("Cookie") ?? null,
          context.req.header("Authorization") ?? null
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
            return context.json({
              error: {
                code: "IDENTITY_LINK_REQUIRED",
                message: "A wallet session and an unlinked email session are both present. Explicitly link these identities before using canonical account features."
              }
            }, 409);
          }
        }
      }

      const canonical = await provisionCanonicalIdentity(db, {
        provider: "better_auth_email",
        providerSubject: emailSession.user.id,
        verifiedAt: new Date()
      });
      context.set("canonicalAuth", {
        canonicalUserId: canonical.id,
        source: "email",
        email: emailSession.user.email,
        displayName: emailSession.user.name
      });
      await next();
      return;
    }

    const token = readWalletSessionCredential(context.req.header("Cookie") ?? null, context.req.header("Authorization") ?? null);
    if (!token) {
      return context.json({
        error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." }
      }, 401);
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
      return context.json({
        error: { code: "UNAUTHORIZED", message: "The wallet session is invalid or expired." }
      }, 401);
    }

    await db.update(walletSessions)
      .set({ lastSeenAt: now })
      .where(eq(walletSessions.id, record.session.id));

    context.set("canonicalAuth", {
      canonicalUserId: record.user.id,
      source: "wallet",
      email: null,
      displayName: "BrightGlobe member",
      walletSessionId: record.session.id
    });
    await next();
  });
}
