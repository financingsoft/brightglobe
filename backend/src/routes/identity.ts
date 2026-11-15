import { and, eq, gt, isNull } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client.js";
import type { BetterAuthInstance } from "../auth.js";
import type { AppEnvironment } from "../config/env.js";
import { resolveAllowedRequestOrigin } from "../config/origins.js";
import {
  canonicalUserProfiles,
  canonicalUsers,
  identityAuditEvents,
  providerIdentities,
  walletOwnerships,
  walletSessions
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import { profileUpdateSchema } from "../domain/profile.js";
import { createRequireCanonicalAuth, type CanonicalAuthVariables } from "../middleware/require-canonical-auth.js";
import { hashWalletSessionToken } from "../auth/wallet/service.js";
import { readWalletSessionCredential } from "../auth/wallet/cookie.js";

async function getOrCreateCanonicalProfile(
  db: Database,
  canonicalUserId: string,
  fallbackDisplayName: string
) {
  await db.insert(canonicalUserProfiles).values({
    canonicalUserId,
    displayName: fallbackDisplayName || "BrightGlobe member",
    locale: "en-US"
  }).onConflictDoNothing({ target: canonicalUserProfiles.canonicalUserId });

  const [profile] = await db.select().from(canonicalUserProfiles)
    .where(eq(canonicalUserProfiles.canonicalUserId, canonicalUserId))
    .limit(1);
  if (!profile) throw new Error("Unable to initialize the canonical user profile.");
  return profile;
}

function serializeCanonicalProfile(profile: typeof canonicalUserProfiles.$inferSelect) {
  return {
    displayName: profile.displayName,
    locale: profile.locale,
    timeZone: profile.timeZone,
    countryCode: profile.countryCode,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

export function createIdentityRoutes(db: Database, auth: BetterAuthInstance, env: AppEnvironment) {
  const routes = new Hono<{ Variables: CanonicalAuthVariables }>();

  // Email linking requires simultaneous proof of a verified Better Auth session
  // and an existing wallet session. Existing identities are never auto-merged.
  routes.post("/link/email", async (context) => {
    const origin = resolveAllowedRequestOrigin(
      context.req.header("Origin"),
      context.req.header("X-BrightGlobe-Client"),
      env.APP_ORIGINS,
      env.NODE_ENV
    );
    if (!origin) {
      return context.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed." } }, 403);
    }

    const emailSession = await auth.api.getSession({ headers: context.req.raw.headers });
    if (!emailSession) {
      return context.json({ error: { code: "EMAIL_SESSION_REQUIRED", message: "Sign in with the email account you want to link." } }, 401);
    }
    if (!emailSession.user.emailVerified) {
      return context.json({ error: { code: "EMAIL_NOT_VERIFIED", message: "Verify the email address before linking it." } }, 403);
    }

    const walletToken = readWalletSessionCredential(
      context.req.header("Cookie") ?? null,
      context.req.header("Authorization") ?? null
    );
    if (!walletToken) {
      return context.json({ error: { code: "WALLET_SESSION_REQUIRED", message: "A valid wallet session is required to link an email identity." } }, 401);
    }

    const now = new Date();
    const tokenHash = await hashWalletSessionToken(walletToken);
    const [walletSession] = await db.select({
      session: walletSessions,
      user: canonicalUsers
    }).from(walletSessions)
      .innerJoin(canonicalUsers, eq(walletSessions.canonicalUserId, canonicalUsers.id))
      .where(and(
        eq(walletSessions.tokenHash, tokenHash),
        isNull(walletSessions.revokedAt),
        gt(walletSessions.expiresAt, now),
        eq(canonicalUsers.status, "active")
      ))
      .limit(1);

    if (!walletSession) {
      return context.json({ error: { code: "WALLET_SESSION_INVALID", message: "The wallet session is invalid or expired." } }, 401);
    }

    const [existing] = await db.select().from(providerIdentities)
      .where(and(
        eq(providerIdentities.provider, "better_auth_email"),
        eq(providerIdentities.providerSubject, emailSession.user.id)
      ))
      .limit(1);

    if (existing && existing.canonicalUserId !== walletSession.user.id) {
      return context.json({
        error: {
          code: "IDENTITY_ALREADY_LINKED",
          message: "This email identity is already linked to another BrightGlobe account. Accounts are not merged automatically."
        }
      }, 409);
    }

    if (existing) {
      if (!existing.verifiedAt) {
        await db.update(providerIdentities)
          .set({ verifiedAt: now })
          .where(eq(providerIdentities.id, existing.id));
      }
    } else {
      try {
        await db.transaction(async (transaction) => {
          await transaction.insert(providerIdentities).values({
            id: createUuidV7(now.getTime()),
            canonicalUserId: walletSession.user.id,
            provider: "better_auth_email",
            providerSubject: emailSession.user.id,
            verifiedAt: now,
            createdAt: now
          });
          await transaction.insert(identityAuditEvents).values({
            id: createUuidV7(now.getTime()),
            canonicalUserId: walletSession.user.id,
            eventType: "email_identity_linked",
            actorType: "email",
            actorId: emailSession.user.id,
            metadata: {}
          });
        });
      } catch (error) {
        const [raced] = await db.select().from(providerIdentities)
          .where(and(
            eq(providerIdentities.provider, "better_auth_email"),
            eq(providerIdentities.providerSubject, emailSession.user.id)
          ))
          .limit(1);
        if (!raced) throw error;
        if (raced.canonicalUserId !== walletSession.user.id) {
          return context.json({
            error: {
              code: "IDENTITY_ALREADY_LINKED",
              message: "This email identity is already linked to another BrightGlobe account. Accounts are not merged automatically."
            }
          }, 409);
        }
      }
    }

    return context.json({
      canonicalUserId: walletSession.user.id,
      linked: true,
      authentication: "email"
    });
  });

  routes.get("/me", createRequireCanonicalAuth(db, auth), async (context) => {
    const current = context.get("canonicalAuth");
    const [profile, wallets] = await Promise.all([
      getOrCreateCanonicalProfile(db, current.canonicalUserId, current.displayName),
      db.select({
        network: walletOwnerships.network,
        address: walletOwnerships.address,
        verifiedAt: walletOwnerships.verifiedAt
      }).from(walletOwnerships)
        .where(eq(walletOwnerships.canonicalUserId, current.canonicalUserId))
    ]);

    return context.json({
      user: {
        id: current.canonicalUserId,
        email: current.email
      },
      profile: serializeCanonicalProfile(profile),
      wallets: wallets.map((wallet) => ({
        network: wallet.network,
        address: wallet.address,
        verifiedAt: wallet.verifiedAt.toISOString()
      }))
    });
  });

  routes.patch("/profile", createRequireCanonicalAuth(db, auth), async (context) => {
    const current = context.get("canonicalAuth");
    const body: unknown = await context.req.json().catch(() => null);
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return context.json({
        error: {
          code: "INVALID_PROFILE",
          message: "The profile payload is invalid.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      }, 400);
    }

    const existing = await getOrCreateCanonicalProfile(db, current.canonicalUserId, current.displayName);
    const data = parsed.data;
    const now = new Date();
    const nextProfile = {
      displayName: data.displayName ?? existing.displayName,
      locale: data.locale ?? existing.locale,
      timeZone: data.timeZone !== undefined ? data.timeZone : existing.timeZone,
      countryCode: data.countryCode !== undefined ? data.countryCode : existing.countryCode,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
      bio: data.bio !== undefined ? data.bio : existing.bio
    };

    const [updated] = await db.insert(canonicalUserProfiles).values({
      canonicalUserId: current.canonicalUserId,
      ...nextProfile,
      updatedAt: now
    }).onConflictDoUpdate({
      target: canonicalUserProfiles.canonicalUserId,
      set: { ...nextProfile, updatedAt: now }
    }).returning();

    if (!updated) throw new Error("Canonical profile update returned no row.");
    return context.json({ profile: serializeCanonicalProfile(updated) });
  });

  return routes;
}
