import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { canonicalUsers, identityAuditEvents, providerIdentities } from "../db/schema.js";
import { createUuidV7 } from "./ids.js";
import type { CanonicalUser, IdentityProvider } from "./types.js";

export class IdentityConflictError extends Error {
  constructor(message = "The identity is already linked to another account.") {
    super(message);
    this.name = "IdentityConflictError";
  }
}

export class CanonicalIdentityUnavailableError extends Error {
  constructor(message = "The canonical identity is unavailable.") {
    super(message);
    this.name = "CanonicalIdentityUnavailableError";
  }
}

/**
 * Idempotently provisions a canonical identity for an authenticated provider
 * subject. The provider subject must come from a verified server-side session,
 * never from an untrusted request body.
 */
export async function provisionCanonicalIdentity(
  db: Database,
  input: {
    provider: IdentityProvider;
    providerSubject: string;
    verifiedAt?: Date | null;
  }
): Promise<CanonicalUser> {
  const subject = input.providerSubject.trim();
  if (!subject || subject.length > 256) {
    throw new TypeError("Provider subject must contain 1 to 256 characters.");
  }

  const existing = await db.select({
    identity: providerIdentities,
    user: canonicalUsers
  })
    .from(providerIdentities)
    .innerJoin(canonicalUsers, eq(providerIdentities.canonicalUserId, canonicalUsers.id))
    .where(and(
      eq(providerIdentities.provider, input.provider),
      eq(providerIdentities.providerSubject, subject)
    ))
    .limit(1);

  if (existing[0]) {
    if (existing[0].user.status !== "active") {
      throw new CanonicalIdentityUnavailableError();
    }
    if (input.verifiedAt && !existing[0].identity.verifiedAt) {
      await db.update(providerIdentities)
        .set({ verifiedAt: input.verifiedAt })
        .where(eq(providerIdentities.id, existing[0].identity.id));
    }
    return existing[0].user;
  }

  const now = new Date();
  const canonicalUserId = createUuidV7(now.getTime());
  const providerIdentityId = createUuidV7(now.getTime());

  try {
    return await db.transaction(async (transaction) => {
      const [createdUser] = await transaction.insert(canonicalUsers).values({
        id: canonicalUserId,
        createdAt: now,
        updatedAt: now
      }).returning();

      if (!createdUser) throw new Error("Canonical user creation returned no row.");

      await transaction.insert(providerIdentities).values({
        id: providerIdentityId,
        canonicalUserId,
        provider: input.provider,
        providerSubject: subject,
        verifiedAt: input.verifiedAt ?? null,
        createdAt: now
      });
      await transaction.insert(identityAuditEvents).values({
        id: createUuidV7(now.getTime()),
        canonicalUserId,
        eventType: "provider_identity_created",
        actorType: "provider",
        actorId: subject,
        metadata: { provider: input.provider },
        createdAt: now
      });

      return createdUser;
    });
  } catch (error) {
    // A concurrent request may have won the unique provider-subject race.
    const raced = await db.select({
      identity: providerIdentities,
      user: canonicalUsers
    })
      .from(providerIdentities)
      .innerJoin(canonicalUsers, eq(providerIdentities.canonicalUserId, canonicalUsers.id))
      .where(and(
        eq(providerIdentities.provider, input.provider),
        eq(providerIdentities.providerSubject, subject)
      ))
      .limit(1);

    if (raced[0]) {
      if (raced[0].user.status !== "active") throw new CanonicalIdentityUnavailableError();
      return raced[0].user;
    }
    throw error;
  }
}
