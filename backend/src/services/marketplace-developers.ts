import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  auditEvents,
  developerInvitations,
  developerMemberships,
  developers
} from "../db/marketplace-schema.js";
import { canonicalUserProfiles } from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DeveloperRole = "owner" | "admin" | "release_manager" | "analyst" | "support_readonly";
export type InvitationRole = Exclude<DeveloperRole, "owner">;

export class MarketplaceDeveloperError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVITATION_INVALID"
      | "INVITATION_EMAIL_MISMATCH",
    message: string
  ) {
    super(message);
    this.name = "MarketplaceDeveloperError";
  }
}

function invalid(message: string): never {
  throw new MarketplaceDeveloperError("INVALID_INPUT", message);
}

export function normalizeDeveloperSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    invalid("Developer slug must be 3–100 lowercase letters, numbers or single hyphens.");
  }
  return slug;
}

export function normalizeInvitationEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalid("A valid invitation email address is required.");
  }
  return email;
}

function createRawInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function hashDeveloperInvitationToken(rawToken: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
    invalid("Invitation token is invalid.");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken.toLowerCase()));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function auditEvent(input: {
  actorCanonicalUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
  now: Date;
}) {
  return {
    id: createUuidV7(input.now.getTime()),
    actorCanonicalUserId: input.actorCanonicalUserId,
    actorType: "user" as const,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    correlationId: input.correlationId,
    metadata: input.metadata ?? {},
    createdAt: input.now
  };
}

async function requireActiveActor(
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
  developerId: string,
  actorCanonicalUserId: string,
  allowedRoles: DeveloperRole[]
) {
  const [membership] = await transaction.select()
    .from(developerMemberships)
    .where(and(
      eq(developerMemberships.developerId, developerId),
      eq(developerMemberships.canonicalUserId, actorCanonicalUserId),
      eq(developerMemberships.status, "active")
    ))
    .limit(1);
  if (!membership || !allowedRoles.includes(membership.role as DeveloperRole)) {
    throw new MarketplaceDeveloperError("FORBIDDEN", "You do not have permission to manage this developer organization.");
  }
  return membership;
}

/**
 * Acquire the organization row before touching membership or invitation rows.
 * Every mutating organization service uses this lock order to serialize owner
 * transfers, invitation acceptance and revocation without lock-order cycles.
 */
async function lockDeveloper(
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
  developerId: string
) {
  const [developer] = await transaction.select()
    .from(developers)
    .where(eq(developers.id, developerId))
    .for("update")
    .limit(1);
  if (!developer) throw new MarketplaceDeveloperError("NOT_FOUND", "Developer organization was not found.");
  if (developer.status === "suspended" || developer.status === "closed") {
    throw new MarketplaceDeveloperError("CONFLICT", "This developer organization cannot be changed in its current state.");
  }
  return developer;
}

function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

/**
 * Creates a publisher organization and its first active owner in one transaction.
 * The organization remains pending until platform verification is completed.
 */
export async function createDeveloperOrganization(
  db: Database,
  input: {
    actorCanonicalUserId: string;
    slug: string;
    displayName: string;
    description?: string | null;
    websiteUrl?: string | null;
    supportEmail?: string | null;
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  const slug = normalizeDeveloperSlug(input.slug);
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 120) invalid("Developer display name must contain 1–120 characters.");

  let websiteUrl: string | null = null;
  if (input.websiteUrl?.trim()) {
    try {
      const parsed = new URL(input.websiteUrl.trim());
      if (parsed.protocol !== "https:") invalid("Developer website must use HTTPS.");
      websiteUrl = parsed.toString();
    } catch {
      invalid("Developer website must be a valid HTTPS URL.");
    }
  }
  const supportEmail = input.supportEmail?.trim()
    ? normalizeInvitationEmail(input.supportEmail)
    : null;
  const developerId = createUuidV7(now.getTime());

  return db.transaction(async (transaction) => {
    const [developer] = await transaction.insert(developers).values({
      id: developerId,
      slug,
      displayName,
      description: input.description?.trim() || null,
      websiteUrl,
      supportEmail,
      createdByCanonicalUserId: input.actorCanonicalUserId,
      createdAt: now,
      updatedAt: now
    }).returning();

    if (!developer) throw new Error("Developer organization creation returned no row.");

    await transaction.insert(developerMemberships).values({
      developerId,
      canonicalUserId: input.actorCanonicalUserId,
      role: "owner",
      status: "active",
      createdByCanonicalUserId: input.actorCanonicalUserId,
      createdAt: now,
      updatedAt: now
    });

    await transaction.insert(auditEvents).values(auditEvent({
      actorCanonicalUserId: input.actorCanonicalUserId,
      action: "developer.organization.created",
      targetType: "developer",
      targetId: developerId,
      correlationId: developerId,
      metadata: { slug },
      now
    }));

    return developer;
  });
}

async function createInvitation(
  db: Database,
  input: {
    developerId: string;
    actorCanonicalUserId: string;
    email: string;
    role: InvitationRole | "owner";
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  const normalizedEmail = normalizeInvitationEmail(input.email);
  const rawToken = createRawInvitationToken();
  const tokenHash = await hashDeveloperInvitationToken(rawToken);
  const invitationId = createUuidV7(now.getTime());
  const expiresAt = invitationExpiry(now);
  let organizationName = "";

  await db.transaction(async (transaction) => {
    const developer = await lockDeveloper(transaction, input.developerId);
    organizationName = developer.displayName;
    await requireActiveActor(
      transaction,
      input.developerId,
      input.actorCanonicalUserId,
      input.role === "owner" ? ["owner"] : ["owner", "admin"]
    );

    if (input.role === "owner") {
      const pending = await transaction.select()
        .from(developerInvitations)
        .where(and(
          eq(developerInvitations.developerId, input.developerId),
          eq(developerInvitations.role, "owner"),
          isNull(developerInvitations.acceptedAt),
          isNull(developerInvitations.revokedAt)
        ))
        .for("update");
      if (pending.length > 0) {
        const hasLiveTransfer = pending.some((item) => item.expiresAt.getTime() > now.getTime());
        throw new MarketplaceDeveloperError(
          "CONFLICT",
          hasLiveTransfer
            ? "An owner transfer is already awaiting acceptance."
            : "Revoke the expired owner-transfer invitation before initiating another transfer."
        );
      }
    }

    await transaction.insert(developerInvitations).values({
      id: invitationId,
      developerId: input.developerId,
      normalizedEmail,
      role: input.role,
      tokenHash,
      invitedByCanonicalUserId: input.actorCanonicalUserId,
      expiresAt,
      createdAt: now
    });

    await transaction.insert(auditEvents).values(auditEvent({
      actorCanonicalUserId: input.actorCanonicalUserId,
      action: input.role === "owner" ? "developer.owner_transfer.initiated" : "developer.invitation.created",
      targetType: "developer_invitation",
      targetId: invitationId,
      correlationId: invitationId,
      metadata: { role: input.role },
      now
    }));

  });

  // The raw token is returned once to the caller for delivery; only its hash is stored.
  return { invitationId, rawToken, expiresAt, organizationName };
}

export async function createDeveloperInvitation(
  db: Database,
  input: {
    developerId: string;
    actorCanonicalUserId: string;
    email: string;
    role: InvitationRole;
    now?: Date;
  }
) {
  return createInvitation(db, input);
}

export async function initiateDeveloperOwnerTransfer(
  db: Database,
  input: {
    developerId: string;
    actorCanonicalUserId: string;
    email: string;
    now?: Date;
  }
) {
  return createInvitation(db, { ...input, role: "owner" });
}

/**
 * Accepts a single-use invitation. verifiedEmail must come from a verified
 * server-side Better Auth session; wallet-only sessions cannot accept invites.
 * Owner transfer demotes the previous owner to admin and promotes the invitee
 * in the same transaction, with both audit events sharing the invitation ID.
 */
export async function acceptDeveloperInvitation(
  db: Database,
  input: {
    rawToken: string;
    canonicalUserId: string;
    verifiedEmail: string;
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  const normalizedEmail = normalizeInvitationEmail(input.verifiedEmail);
  const tokenHash = await hashDeveloperInvitationToken(input.rawToken);
  const [candidate] = await db.select({ developerId: developerInvitations.developerId })
    .from(developerInvitations)
    .where(eq(developerInvitations.tokenHash, tokenHash))
    .limit(1);
  if (!candidate) throw new MarketplaceDeveloperError("INVITATION_INVALID", "Invitation is invalid, expired or already used.");

  return db.transaction(async (transaction) => {
    await lockDeveloper(transaction, candidate.developerId);
    const [invitation] = await transaction.select()
      .from(developerInvitations)
      .where(eq(developerInvitations.tokenHash, tokenHash))
      .for("update")
      .limit(1);

    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt.getTime() <= now.getTime()) {
      throw new MarketplaceDeveloperError("INVITATION_INVALID", "Invitation is invalid, expired or already used.");
    }
    if (invitation.normalizedEmail !== normalizedEmail) {
      throw new MarketplaceDeveloperError("INVITATION_EMAIL_MISMATCH", "Sign in with the verified email address that received this invitation.");
    }
    if (invitation.invitedByCanonicalUserId === input.canonicalUserId) {
      throw new MarketplaceDeveloperError("CONFLICT", "The inviter cannot accept their own invitation.");
    }

    const [existingMembership] = await transaction.select()
      .from(developerMemberships)
      .where(and(
        eq(developerMemberships.developerId, invitation.developerId),
        eq(developerMemberships.canonicalUserId, input.canonicalUserId)
      ))
      .for("update")
      .limit(1);
    if (existingMembership?.status === "suspended") {
      throw new MarketplaceDeveloperError("CONFLICT", "A suspended organization membership cannot be reactivated by invitation.");
    }

    if (invitation.role === "owner") {
      const [inviterMembership] = await transaction.select()
        .from(developerMemberships)
        .where(and(
          eq(developerMemberships.developerId, invitation.developerId),
          eq(developerMemberships.canonicalUserId, invitation.invitedByCanonicalUserId),
          eq(developerMemberships.role, "owner"),
          eq(developerMemberships.status, "active")
        ))
        .for("update")
        .limit(1);
      if (!inviterMembership) {
        throw new MarketplaceDeveloperError("CONFLICT", "The initiating owner is no longer the active organization owner.");
      }

      await transaction.update(developerMemberships)
        .set({ role: "admin", updatedAt: now })
        .where(and(
          eq(developerMemberships.developerId, invitation.developerId),
          eq(developerMemberships.canonicalUserId, invitation.invitedByCanonicalUserId),
          eq(developerMemberships.role, "owner"),
          eq(developerMemberships.status, "active")
        ));

      if (existingMembership) {
        await transaction.update(developerMemberships)
          .set({ role: "owner", status: "active", updatedAt: now })
          .where(and(
            eq(developerMemberships.developerId, invitation.developerId),
            eq(developerMemberships.canonicalUserId, input.canonicalUserId)
          ));
      } else {
        await transaction.insert(developerMemberships).values({
          developerId: invitation.developerId,
          canonicalUserId: input.canonicalUserId,
          role: "owner",
          status: "active",
          createdByCanonicalUserId: invitation.invitedByCanonicalUserId,
          createdAt: now,
          updatedAt: now
        });
      }
    } else {
      const [inviterMembership] = await transaction.select()
        .from(developerMemberships)
        .where(and(
          eq(developerMemberships.developerId, invitation.developerId),
          eq(developerMemberships.canonicalUserId, invitation.invitedByCanonicalUserId),
          eq(developerMemberships.status, "active")
        ))
        .limit(1);
      if (!inviterMembership || (inviterMembership.role !== "owner" && inviterMembership.role !== "admin")) {
        throw new MarketplaceDeveloperError("CONFLICT", "The inviter no longer has permission to manage organization members.");
      }
      if (existingMembership?.status === "active") {
        throw new MarketplaceDeveloperError("CONFLICT", "This user is already an active organization member.");
      }

      if (existingMembership) {
        await transaction.update(developerMemberships)
          .set({ role: invitation.role, status: "active", updatedAt: now })
          .where(and(
            eq(developerMemberships.developerId, invitation.developerId),
            eq(developerMemberships.canonicalUserId, input.canonicalUserId)
          ));
      } else {
        await transaction.insert(developerMemberships).values({
          developerId: invitation.developerId,
          canonicalUserId: input.canonicalUserId,
          role: invitation.role,
          status: "active",
          createdByCanonicalUserId: invitation.invitedByCanonicalUserId,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    await transaction.update(developerInvitations)
      .set({ acceptedAt: now, acceptedByCanonicalUserId: input.canonicalUserId })
      .where(eq(developerInvitations.id, invitation.id));

    await transaction.insert(auditEvents).values(auditEvent({
      actorCanonicalUserId: input.canonicalUserId,
      action: invitation.role === "owner" ? "developer.owner_transfer.accepted" : "developer.invitation.accepted",
      targetType: "developer_invitation",
      targetId: invitation.id,
      correlationId: invitation.id,
      metadata: { developerId: invitation.developerId, role: invitation.role },
      now
    }));

    return {
      developerId: invitation.developerId,
      role: invitation.role,
      ownerTransferred: invitation.role === "owner"
    };
  });
}

export async function revokeDeveloperInvitation(
  db: Database,
  input: {
    developerId: string;
    invitationId: string;
    actorCanonicalUserId: string;
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  return db.transaction(async (transaction) => {
    await lockDeveloper(transaction, input.developerId);
    const actor = await requireActiveActor(
      transaction,
      input.developerId,
      input.actorCanonicalUserId,
      ["owner", "admin"]
    );
    const [invitation] = await transaction.select()
      .from(developerInvitations)
      .where(and(
        eq(developerInvitations.id, input.invitationId),
        eq(developerInvitations.developerId, input.developerId)
      ))
      .for("update")
      .limit(1);
    if (!invitation) throw new MarketplaceDeveloperError("NOT_FOUND", "Invitation was not found.");
    if (invitation.acceptedAt || invitation.revokedAt) {
      throw new MarketplaceDeveloperError("CONFLICT", "Only a pending invitation can be revoked.");
    }
    if (
      invitation.role === "owner" &&
      (actor.role !== "owner" || invitation.invitedByCanonicalUserId !== input.actorCanonicalUserId)
    ) {
      throw new MarketplaceDeveloperError("FORBIDDEN", "Only the owner who initiated a transfer can revoke it.");
    }

    await transaction.update(developerInvitations)
      .set({ revokedAt: now })
      .where(eq(developerInvitations.id, invitation.id));

    await transaction.insert(auditEvents).values(auditEvent({
      actorCanonicalUserId: input.actorCanonicalUserId,
      action: invitation.role === "owner" ? "developer.owner_transfer.revoked" : "developer.invitation.revoked",
      targetType: "developer_invitation",
      targetId: invitation.id,
      correlationId: invitation.id,
      metadata: { developerId: input.developerId, role: invitation.role },
      now
    }));
    return { invitationId: invitation.id, revokedAt: now };
  });
}


/** List only organizations in which the current canonical user is an active member. */
export async function listDeveloperOrganizations(db: Database, actorCanonicalUserId: string) {
  return db.select({
    id: developers.id,
    slug: developers.slug,
    displayName: developers.displayName,
    status: developers.status,
    verificationStatus: developers.verificationStatus,
    createdAt: developers.createdAt,
    role: developerMemberships.role
  })
    .from(developerMemberships)
    .innerJoin(developers, eq(developers.id, developerMemberships.developerId))
    .where(and(
      eq(developerMemberships.canonicalUserId, actorCanonicalUserId),
      eq(developerMemberships.status, "active")
    ))
    .orderBy(asc(developers.displayName), asc(developers.id));
}

/**
 * Return a tenant-scoped workspace. A missing or inaccessible organization
 * deliberately produces the same NOT_FOUND result to prevent ID enumeration.
 */
export async function getDeveloperWorkspace(
  db: Database,
  input: { developerId: string; actorCanonicalUserId: string }
) {
  const [organization] = await db.select({
    id: developers.id,
    slug: developers.slug,
    displayName: developers.displayName,
    description: developers.description,
    websiteUrl: developers.websiteUrl,
    supportEmail: developers.supportEmail,
    status: developers.status,
    verificationStatus: developers.verificationStatus,
    createdAt: developers.createdAt,
    role: developerMemberships.role
  })
    .from(developers)
    .innerJoin(developerMemberships, eq(developerMemberships.developerId, developers.id))
    .where(and(
      eq(developers.id, input.developerId),
      eq(developerMemberships.canonicalUserId, input.actorCanonicalUserId),
      eq(developerMemberships.status, "active")
    ))
    .limit(1);

  if (!organization) {
    throw new MarketplaceDeveloperError("NOT_FOUND", "Developer organization was not found.");
  }

  const members = await db.select({
    canonicalUserId: developerMemberships.canonicalUserId,
    displayName: canonicalUserProfiles.displayName,
    role: developerMemberships.role,
    status: developerMemberships.status,
    createdAt: developerMemberships.createdAt
  })
    .from(developerMemberships)
    .leftJoin(
      canonicalUserProfiles,
      eq(canonicalUserProfiles.canonicalUserId, developerMemberships.canonicalUserId)
    )
    .where(and(
      eq(developerMemberships.developerId, input.developerId),
      eq(developerMemberships.status, "active")
    ))
    .orderBy(asc(developerMemberships.createdAt), asc(developerMemberships.canonicalUserId));

  const canManageMembers = organization.role === "owner" || organization.role === "admin";
  const invitations = canManageMembers
    ? await db.select({
        id: developerInvitations.id,
        email: developerInvitations.normalizedEmail,
        role: developerInvitations.role,
        invitedByCanonicalUserId: developerInvitations.invitedByCanonicalUserId,
        expiresAt: developerInvitations.expiresAt,
        createdAt: developerInvitations.createdAt
      })
        .from(developerInvitations)
        .where(and(
          eq(developerInvitations.developerId, input.developerId),
          isNull(developerInvitations.acceptedAt),
          isNull(developerInvitations.revokedAt),
          gt(developerInvitations.expiresAt, new Date())
        ))
        .orderBy(asc(developerInvitations.createdAt))
    : [];

  const visibleInvitations = invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    canRevoke: invitation.role !== "owner" ||
      (organization.role === "owner" && invitation.invitedByCanonicalUserId === input.actorCanonicalUserId)
  }));

  return { organization, members, invitations: visibleInvitations };
}
