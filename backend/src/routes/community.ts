import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client.js";
import type { BetterAuthInstance } from "../auth.js";
import {
  communityAnnouncements,
  communityEvents,
  communityTasks,
  invitationAttributions,
  invitationCodes
} from "../db/schema.js";
import { createRequireAuth, type AuthVariables } from "../middleware/require-auth.js";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function createCode(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function createCommunityRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", createRequireAuth(auth));

  routes.get("/tasks", async (context) => {
    const now = new Date();
    const rows = await db.select({
      id: communityTasks.id,
      slug: communityTasks.slug,
      title: communityTasks.title,
      summary: communityTasks.summary,
      category: communityTasks.category,
      startsAt: communityTasks.startsAt,
      endsAt: communityTasks.endsAt
    }).from(communityTasks).where(and(
      eq(communityTasks.status, "published"),
      or(isNull(communityTasks.startsAt), lte(communityTasks.startsAt, now)),
      or(isNull(communityTasks.endsAt), gt(communityTasks.endsAt, now))
    )).orderBy(communityTasks.category, communityTasks.title);
    return context.json({ items: rows, rewardsEnabled: false });
  });

  routes.get("/invites/me", async (context) => {
    const current = context.get("authSession");
    let [record] = await db.select().from(invitationCodes)
      .where(eq(invitationCodes.inviterUserId, current.user.id)).limit(1);
    if (!record) {
      for (let attempt = 0; attempt < 5 && !record; attempt += 1) {
        const candidate = { id: crypto.randomUUID(), inviterUserId: current.user.id, code: createCode(), status: "active" as const };
        const inserted = await db.insert(invitationCodes).values(candidate)
          .onConflictDoNothing().returning();
        record = inserted[0];
        if (!record) {
          [record] = await db.select().from(invitationCodes)
            .where(eq(invitationCodes.inviterUserId, current.user.id)).limit(1);
        }
      }
    }
    if (!record) return context.json({ error: { code: "INVITATION_CODE_UNAVAILABLE", message: "Unable to issue an invitation code." } }, 503);
    const referrals = await db.select({ id: invitationAttributions.id, status: invitationAttributions.status, createdAt: invitationAttributions.createdAt })
      .from(invitationAttributions).where(eq(invitationAttributions.inviterUserId, current.user.id))
      .orderBy(desc(invitationAttributions.createdAt)).limit(50);
    return context.json({
      code: record.code,
      status: record.status,
      referralCount: referrals.length,
      referrals: referrals.map((item) => ({ id: item.id, status: item.status, createdAt: item.createdAt.toISOString() })),
      rewardsEnabled: false
    });
  });

  routes.post("/invites/claim", async (context) => {
    const current = context.get("authSession");
    const body: unknown = await context.req.json().catch(() => null);
    const code = typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
      ? body.code.trim().toUpperCase() : "";
    if (!/^[A-HJ-NP-Z2-9]{6,16}$/.test(code)) {
      return context.json({ error: { code: "INVALID_INVITATION_CODE", message: "The invitation code is invalid." } }, 400);
    }
    const [invitation] = await db.select().from(invitationCodes)
      .where(and(eq(invitationCodes.code, code), eq(invitationCodes.status, "active"))).limit(1);
    if (!invitation) return context.json({ error: { code: "INVITATION_CODE_NOT_FOUND", message: "The invitation code was not found." } }, 404);
    if (invitation.inviterUserId === current.user.id) {
      return context.json({ error: { code: "SELF_INVITATION_NOT_ALLOWED", message: "You cannot use your own invitation code." } }, 409);
    }
    const [existing] = await db.select({ id: invitationAttributions.id })
      .from(invitationAttributions).where(eq(invitationAttributions.inviteeUserId, current.user.id)).limit(1);
    if (existing) return context.json({ error: { code: "INVITATION_ALREADY_CLAIMED", message: "An invitation has already been attributed to this account." } }, 409);
    const [created] = await db.insert(invitationAttributions).values({
      id: crypto.randomUUID(),
      inviterUserId: invitation.inviterUserId,
      inviteeUserId: current.user.id,
      invitationCodeId: invitation.id,
      status: "attributed"
    }).onConflictDoNothing().returning({ id: invitationAttributions.id });
    if (!created) return context.json({ error: { code: "INVITATION_ALREADY_CLAIMED", message: "An invitation has already been attributed to this account." } }, 409);
    return context.json({ attributed: true, rewardsEnabled: false }, 201);
  });

  routes.get("/announcements", async (context) => {
    const rows = await db.select({
      id: communityAnnouncements.id,
      slug: communityAnnouncements.slug,
      title: communityAnnouncements.title,
      summary: communityAnnouncements.summary,
      locale: communityAnnouncements.locale,
      publishedAt: communityAnnouncements.publishedAt
    }).from(communityAnnouncements)
      .where(eq(communityAnnouncements.status, "published"))
      .orderBy(desc(communityAnnouncements.publishedAt)).limit(50);
    return context.json({ items: rows.map((row) => ({ ...row, publishedAt: row.publishedAt?.toISOString() ?? null })) });
  });

  routes.get("/announcements/:slug", async (context) => {
    const [row] = await db.select().from(communityAnnouncements).where(and(
      eq(communityAnnouncements.slug, context.req.param("slug")),
      eq(communityAnnouncements.status, "published")
    )).limit(1);
    if (!row) return context.json({ error: { code: "ANNOUNCEMENT_NOT_FOUND", message: "The announcement was not found." } }, 404);
    return context.json({ item: { id: row.id, slug: row.slug, title: row.title, summary: row.summary, body: row.body, locale: row.locale, publishedAt: row.publishedAt?.toISOString() ?? null } });
  });

  routes.get("/events", async (context) => {
    const rows = await db.select({
      id: communityEvents.id,
      slug: communityEvents.slug,
      title: communityEvents.title,
      summary: communityEvents.summary,
      startsAt: communityEvents.startsAt,
      endsAt: communityEvents.endsAt,
      status: communityEvents.status
    }).from(communityEvents).where(eq(communityEvents.status, "published"))
      .orderBy(communityEvents.startsAt).limit(50);
    return context.json({ items: rows.map((row) => ({
      ...row,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null
    })) });
  });

  return routes;
}
