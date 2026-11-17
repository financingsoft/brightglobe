import assert from "node:assert/strict";
import test from "node:test";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { canonicalUsers, schema } from "../db/schema.js";
import {
  auditEvents,
  developerInvitations,
  developerMemberships,
  developers,
  marketplaceSchema
} from "../db/marketplace-schema.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  acceptDeveloperInvitation,
  createDeveloperInvitation,
  createDeveloperOrganization,
  hashDeveloperInvitationToken,
  initiateDeveloperOwnerTransfer,
  revokeDeveloperInvitation,
  MarketplaceDeveloperError
} from "./marketplace-developers.js";

const connectionString = process.env.LOCAL_DATABASE_URL;

test("Marketplace developer transactions preserve tenant, invitation and owner invariants in PostgreSQL", {
  skip: !connectionString ? "LOCAL_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async (t) => {
  const pool = new PgPool({ connectionString });
  const db = drizzle(pool, { schema: { ...schema, ...marketplaceSchema } }) as unknown as Database;
  const userIds: string[] = [];
  const developerIds: string[] = [];

  async function addCanonicalUser() {
    const id = createUuidV7();
    await pool.query("INSERT INTO public.canonical_users (id) VALUES ($1)", [id]);
    userIds.push(id);
    return id;
  }

  async function createOrganization(ownerId: string, slug: string) {
    const organization = await createDeveloperOrganization(db, {
      actorCanonicalUserId: ownerId,
      slug,
      displayName: slug.replace(/-/g, " ")
    });
    developerIds.push(organization.id);
    return organization;
  }

  try {
    await pool.query("SELECT 1 FROM marketplace.developers LIMIT 0");
    await t.test("organization creation atomically creates its first active Owner and audit event", async () => {
      const ownerId = await addCanonicalUser();
      const organization = await createOrganization(ownerId, "pg-owner-" + ownerId.slice(-8));
      const memberships = await db.select().from(developerMemberships)
        .where(eq(developerMemberships.developerId, organization.id));
      assert.equal(memberships.length, 1);
      assert.equal(memberships[0]?.canonicalUserId, ownerId);
      assert.equal(memberships[0]?.role, "owner");
      assert.equal(memberships[0]?.status, "active");

      const events = await db.select().from(auditEvents)
        .where(and(
          eq(auditEvents.targetType, "developer"),
          eq(auditEvents.targetId, organization.id)
        ));
      assert.equal(events.length, 1);
      assert.equal(events[0]?.action, "developer.organization.created");
    });

    await t.test("invitation stores only a SHA-256 token hash and binds acceptance to verified email", async () => {
      const ownerId = await addCanonicalUser();
      const inviteeId = await addCanonicalUser();
      const organization = await createOrganization(ownerId, "pg-invite-" + ownerId.slice(-8));
      const invitation = await createDeveloperInvitation(db, {
        developerId: organization.id,
        actorCanonicalUserId: ownerId,
        email: "Invitee@Example.com",
        role: "release_manager"
      });
      const [stored] = await db.select().from(developerInvitations)
        .where(eq(developerInvitations.id, invitation.invitationId));
      assert.ok(stored);
      assert.equal(stored.normalizedEmail, "invitee@example.com");
      assert.equal(stored.tokenHash, await hashDeveloperInvitationToken(invitation.rawToken));
      assert.notEqual(stored.tokenHash, invitation.rawToken);

      await assert.rejects(
        () => acceptDeveloperInvitation(db, {
          rawToken: invitation.rawToken,
          canonicalUserId: inviteeId,
          verifiedEmail: "attacker@example.com"
        }),
        (error: unknown) => error instanceof MarketplaceDeveloperError && error.code === "INVITATION_EMAIL_MISMATCH"
      );

      const accepted = await acceptDeveloperInvitation(db, {
        rawToken: invitation.rawToken,
        canonicalUserId: inviteeId,
        verifiedEmail: "INVITEE@example.com"
      });
      assert.equal(accepted.role, "release_manager");
      assert.equal(accepted.ownerTransferred, false);

      const memberships = await db.select().from(developerMemberships)
        .where(and(
          eq(developerMemberships.developerId, organization.id),
          eq(developerMemberships.canonicalUserId, inviteeId)
        ));
      assert.equal(memberships[0]?.status, "active");
      assert.equal(memberships[0]?.role, "release_manager");

      await assert.rejects(
        () => acceptDeveloperInvitation(db, {
          rawToken: invitation.rawToken,
          canonicalUserId: inviteeId,
          verifiedEmail: "invitee@example.com"
        }),
        (error: unknown) => error instanceof MarketplaceDeveloperError && error.code === "INVITATION_INVALID"
      );
    });

    await t.test("non-members cannot create invitations for another tenant", async () => {
      const ownerId = await addCanonicalUser();
      const strangerId = await addCanonicalUser();
      const organization = await createOrganization(ownerId, "pg-tenant-" + ownerId.slice(-8));
      await assert.rejects(
        () => createDeveloperInvitation(db, {
          developerId: organization.id,
          actorCanonicalUserId: strangerId,
          email: "target@example.com",
          role: "analyst"
        }),
        (error: unknown) => error instanceof MarketplaceDeveloperError && error.code === "FORBIDDEN"
      );
    });

    await t.test("Owner transfer atomically demotes the old Owner and promotes the verified recipient", async () => {
      const oldOwnerId = await addCanonicalUser();
      const newOwnerId = await addCanonicalUser();
      const organization = await createOrganization(oldOwnerId, "pg-transfer-" + oldOwnerId.slice(-8));
      const invitation = await initiateDeveloperOwnerTransfer(db, {
        developerId: organization.id,
        actorCanonicalUserId: oldOwnerId,
        email: "new-owner@example.com"
      });
      const result = await acceptDeveloperInvitation(db, {
        rawToken: invitation.rawToken,
        canonicalUserId: newOwnerId,
        verifiedEmail: "new-owner@example.com"
      });
      assert.equal(result.ownerTransferred, true);

      const memberships = await db.select().from(developerMemberships)
        .where(eq(developerMemberships.developerId, organization.id));
      const oldOwner = memberships.find((item) => item.canonicalUserId === oldOwnerId);
      const newOwner = memberships.find((item) => item.canonicalUserId === newOwnerId);
      assert.equal(oldOwner?.role, "admin");
      assert.equal(oldOwner?.status, "active");
      assert.equal(newOwner?.role, "owner");
      assert.equal(newOwner?.status, "active");
      assert.equal(memberships.filter((item) => item.role === "owner" && item.status === "active").length, 1);
    });

    await t.test("concurrent acceptance of one invitation succeeds exactly once", async () => {
      const ownerId = await addCanonicalUser();
      const inviteeId = await addCanonicalUser();
      const organization = await createOrganization(ownerId, "pg-race-" + ownerId.slice(-8));
      const invitation = await createDeveloperInvitation(db, {
        developerId: organization.id,
        actorCanonicalUserId: ownerId,
        email: "race@example.com",
        role: "analyst"
      });

      const outcomes = await Promise.allSettled([
        acceptDeveloperInvitation(db, {
          rawToken: invitation.rawToken,
          canonicalUserId: inviteeId,
          verifiedEmail: "race@example.com"
        }),
        acceptDeveloperInvitation(db, {
          rawToken: invitation.rawToken,
          canonicalUserId: inviteeId,
          verifiedEmail: "race@example.com"
        })
      ]);
      assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((item) => item.status === "rejected").length, 1);
      const accepted = await db.select().from(developerInvitations)
        .where(eq(developerInvitations.id, invitation.invitationId));
      assert.ok(accepted[0]?.acceptedAt);
    });

    await t.test("only the initiating Owner can revoke a pending owner-transfer invitation", async () => {
      const oldOwnerId = await addCanonicalUser();
      const replacementId = await addCanonicalUser();
      const organization = await createOrganization(oldOwnerId, "pg-revoke-" + oldOwnerId.slice(-8));
      const transfer = await initiateDeveloperOwnerTransfer(db, {
        developerId: organization.id,
        actorCanonicalUserId: oldOwnerId,
        email: "replacement@example.com"
      });

      await assert.rejects(
        () => revokeDeveloperInvitation(db, {
          developerId: organization.id,
          invitationId: transfer.invitationId,
          actorCanonicalUserId: replacementId
        }),
        (error: unknown) => error instanceof MarketplaceDeveloperError && error.code === "FORBIDDEN"
      );

      const revoked = await revokeDeveloperInvitation(db, {
        developerId: organization.id,
        invitationId: transfer.invitationId,
        actorCanonicalUserId: oldOwnerId
      });
      assert.equal(revoked.invitationId, transfer.invitationId);
    });
  } finally {
    for (const developerId of developerIds) {
      await pool.query(
        "DELETE FROM marketplace.audit_events WHERE target_id = $1 OR actor_canonical_user_id = ANY($2::uuid[])",
        [developerId, userIds]
      );
      await pool.query("DELETE FROM marketplace.developer_invitations WHERE developer_id = $1", [developerId]);
      await pool.query("DELETE FROM marketplace.developer_memberships WHERE developer_id = $1", [developerId]);
      await pool.query("DELETE FROM marketplace.developers WHERE id = $1", [developerId]);
    }
    for (const userId of userIds) {
      await pool.query("DELETE FROM public.canonical_users WHERE id = $1", [userId]);
    }
    await pool.end();
  }
});
