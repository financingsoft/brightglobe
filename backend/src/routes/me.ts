import { and, desc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { profileUpdateSchema } from "../domain/profile.js";
import { canRevokeSession } from "../domain/session-revocation.js";
import type { Database } from "../db/client.js";
import type { BetterAuthInstance } from "../auth.js";
import { session as sessions, user, userProfile } from "../db/schema.js";
import { createRequireAuth, type AuthVariables } from "../middleware/require-auth.js";

export function createMeRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono<{ Variables: AuthVariables }>();

async function getOrCreateProfile(userId: string, fallbackName: string) {
  await db.insert(userProfile).values({
    userId,
    displayName: fallbackName,
    locale: "en-US"
  }).onConflictDoNothing({ target: userProfile.userId });

  const [profile] = await db.select().from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1);

  if (!profile) throw new Error("Unable to initialize the user profile.");
  return profile;
}

function serializeProfile(profile: typeof userProfile.$inferSelect) {
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

routes.use("*", createRequireAuth(auth));

routes.get("/", async (context) => {
  const current = context.get("authSession");
  const profile = await getOrCreateProfile(current.user.id, current.user.name);
  return context.json({
    user: {
      id: current.user.id,
      name: current.user.name,
      email: current.user.emailVerified ? current.user.email : null,
      phoneNumber: current.user.phoneNumber ?? null,
      phoneNumberVerified: current.user.phoneNumberVerified ?? false
    },
    profile: serializeProfile(profile)
  });
});

routes.patch("/profile", async (context) => {
  const current = context.get("authSession");
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

  const now = new Date();
  const data = parsed.data;
  const updateValues: Partial<typeof userProfile.$inferInsert> = { updatedAt: now };
  if (data.displayName !== undefined) updateValues.displayName = data.displayName;
  if (data.locale !== undefined) updateValues.locale = data.locale;
  if (data.timeZone !== undefined) updateValues.timeZone = data.timeZone;
  if (data.countryCode !== undefined) updateValues.countryCode = data.countryCode;
  if (data.avatarUrl !== undefined) updateValues.avatarUrl = data.avatarUrl;
  if (data.bio !== undefined) updateValues.bio = data.bio;

  const [profile] = await db.transaction(async (transaction) => {
    if (data.displayName !== undefined) {
      await transaction.update(user)
        .set({ name: data.displayName, updatedAt: now })
        .where(eq(user.id, current.user.id));
    }

    await transaction.insert(userProfile).values({
      userId: current.user.id,
      displayName: data.displayName ?? current.user.name,
      locale: data.locale ?? "en-US",
      timeZone: data.timeZone ?? null,
      countryCode: data.countryCode ?? null,
      avatarUrl: data.avatarUrl ?? null,
      bio: data.bio ?? null,
      updatedAt: now
    }).onConflictDoUpdate({
      target: userProfile.userId,
      set: updateValues
    });

    return transaction.select().from(userProfile)
      .where(eq(userProfile.userId, current.user.id))
      .limit(1);
  });

  if (!profile) throw new Error("Profile update completed without a readable row.");
  return context.json({ profile: serializeProfile(profile) });
});

routes.get("/sessions", async (context) => {
  const current = context.get("authSession");
  const records = await db.select({
    id: sessions.id,
    createdAt: sessions.createdAt,
    expiresAt: sessions.expiresAt,
    ipAddress: sessions.ipAddress,
    userAgent: sessions.userAgent
  }).from(sessions)
    .where(eq(sessions.userId, current.user.id))
    .orderBy(desc(sessions.createdAt));

  return context.json({
    sessions: records.map((record) => ({
      ...record,
      isCurrent: record.id === current.session.id
    }))
  });
});

routes.delete("/sessions/:sessionId", async (context) => {
  const current = context.get("authSession");
  const sessionId = context.req.param("sessionId");
  if (!sessionId || sessionId.length > 128) {
    return context.json({
      error: { code: "INVALID_SESSION_ID", message: "The session ID is invalid." }
    }, 400);
  }
  if (!canRevokeSession(sessionId, current.session.id)) {
    return context.json({
      error: {
        code: "CURRENT_SESSION_CANNOT_BE_REVOKED",
        message: "Use the sign-out endpoint to end the current session."
      }
    }, 409);
  }

  const deleted = await db.delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, current.user.id)))
    .returning({ id: sessions.id });
  if (deleted.length === 0) {
    return context.json({
      error: { code: "SESSION_NOT_FOUND", message: "The session was not found." }
    }, 404);
  }
  return context.body(null, 204);
});

routes.post("/sessions/revoke-others", async (context) => {
  const current = context.get("authSession");
  const deleted = await db.delete(sessions)
    .where(and(eq(sessions.userId, current.user.id), ne(sessions.id, current.session.id)))
    .returning({ id: sessions.id });
  return context.json({ revokedCount: deleted.length });
});

  return routes;
}
