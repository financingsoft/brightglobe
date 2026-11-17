import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { bgTaskEvidenceRecords } from "../db/schema.js";
import { createUuidV7, isUuidV7 } from "../identity/ids.js";
import type { BgTaskVerification } from "./bg-task-verifier.js";

export type BgTaskEvidencePersistenceErrorCode =
  | "INVALID_VERIFICATION"
  | "SOURCE_EVIDENCE_REPLAY"
  | "SOURCE_EVIDENCE_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_INTEGRITY_ERROR";

export class BgTaskEvidencePersistenceError extends Error {
  constructor(
    readonly code: BgTaskEvidencePersistenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "BgTaskEvidencePersistenceError";
  }
}

export interface PersistedBgTaskEvidence {
  outcome: "persisted" | "replayed";
  evidenceId: string;
  canonicalUserId: string;
  taskId: string;
  taskVersion: number;
  verifierKey: string;
  source: string;
  issuer: "brightglobe-server" | "trusted-provider";
  sourceEvidenceId: string;
  digestSha256: string;
  idempotencyKey: string;
  status: "pending_review";
}

/**
 * Persists only a result produced by the trusted server verifier pipeline.
 * This is an internal service boundary, not a public claim API: callers must
 * never map request-body evidence into BgTaskVerification.
 *
 * Even an automatic verifier result is stored as pending_review. Approval,
 * budget reservation and payout are separate, later transactional steps.
 */
export async function persistBgTaskEvidence(
  db: Database,
  verification: BgTaskVerification,
  submittedAt = new Date()
): Promise<PersistedBgTaskEvidence> {
  if (
    verification.outcome === "not_eligible" ||
    !isUuidV7(verification.canonicalUserId) ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(verification.taskId) ||
    !Number.isSafeInteger(verification.taskVersion) ||
    verification.taskVersion < 1 ||
    !/^[a-z][a-z0-9._-]{2,63}$/.test(verification.verifierKey) ||
    !/^[a-z][a-z0-9._-]{1,63}$/.test(verification.source) ||
    (verification.issuer !== "brightglobe-server" && verification.issuer !== "trusted-provider") ||
    !/^[A-Za-z0-9._-]{1,32}$/.test(verification.sourceEvidenceId) ||
    !/^[a-f0-9]{64}$/.test(verification.evidenceDigest) ||
    typeof verification.idempotencyKey !== "string" ||
    verification.idempotencyKey.length < 1 ||
    verification.idempotencyKey.length > 160 ||
    !Number.isFinite(Date.parse(verification.occurredAt)) ||
    Number.isNaN(submittedAt.getTime()) ||
    Date.parse(verification.occurredAt) > submittedAt.getTime()
  ) {
    throw new BgTaskEvidencePersistenceError(
      "INVALID_VERIFICATION",
      "A complete, valid server-verified task evidence result is required."
    );
  }

  const occurredAt = new Date(verification.occurredAt);
  const identityMatches = (row: typeof bgTaskEvidenceRecords.$inferSelect) =>
    row.canonicalUserId === verification.canonicalUserId &&
    row.taskId === verification.taskId &&
    row.taskVersion === verification.taskVersion &&
    row.verifierKey === verification.verifierKey &&
    row.source === verification.source &&
    row.issuer === verification.issuer &&
    row.sourceEvidenceId === verification.sourceEvidenceId &&
    row.occurredAt.getTime() === occurredAt.getTime() &&
    row.digestSha256 === verification.evidenceDigest &&
    row.idempotencyKey === verification.idempotencyKey;

  return db.transaction(async (tx) => {
    const [inserted] = await tx.insert(bgTaskEvidenceRecords).values({
      id: createUuidV7(submittedAt.getTime()),
      canonicalUserId: verification.canonicalUserId,
      taskId: verification.taskId,
      taskVersion: verification.taskVersion,
      verifierKey: verification.verifierKey,
      source: verification.source,
      issuer: verification.issuer,
      sourceEvidenceId: verification.sourceEvidenceId,
      occurredAt,
      digestSha256: verification.evidenceDigest,
      idempotencyKey: verification.idempotencyKey,
      status: "pending_review",
      submittedAt,
      updatedAt: submittedAt
    }).onConflictDoNothing().returning();

    if (inserted) {
      return {
        outcome: "persisted",
        evidenceId: inserted.id,
        canonicalUserId: inserted.canonicalUserId,
        taskId: inserted.taskId,
        taskVersion: inserted.taskVersion,
        verifierKey: inserted.verifierKey,
        source: inserted.source,
        issuer: inserted.issuer as "brightglobe-server" | "trusted-provider",
        sourceEvidenceId: inserted.sourceEvidenceId,
        digestSha256: inserted.digestSha256,
        idempotencyKey: inserted.idempotencyKey,
        status: "pending_review"
      };
    }

    // A uniqueness conflict can be either a safe idempotent retry or a
    // source-evidence replay. Never infer which one from the conflict alone.
    const [byIdempotency] = await tx.select().from(bgTaskEvidenceRecords)
      .where(eq(bgTaskEvidenceRecords.idempotencyKey, verification.idempotencyKey))
      .limit(1);

    if (byIdempotency) {
      if (!identityMatches(byIdempotency)) {
        throw new BgTaskEvidencePersistenceError(
          "IDEMPOTENCY_CONFLICT",
          "The task idempotency key is already bound to different evidence."
        );
      }
      return {
        outcome: "replayed",
        evidenceId: byIdempotency.id,
        canonicalUserId: byIdempotency.canonicalUserId,
        taskId: byIdempotency.taskId,
        taskVersion: byIdempotency.taskVersion,
        verifierKey: byIdempotency.verifierKey,
        source: byIdempotency.source,
        issuer: byIdempotency.issuer as "brightglobe-server" | "trusted-provider",
        sourceEvidenceId: byIdempotency.sourceEvidenceId,
        digestSha256: byIdempotency.digestSha256,
        idempotencyKey: byIdempotency.idempotencyKey,
        status: "pending_review"
      };
    }

    const [bySourceEvidence] = await tx.select().from(bgTaskEvidenceRecords)
      .where(and(
        eq(bgTaskEvidenceRecords.issuer, verification.issuer),
        eq(bgTaskEvidenceRecords.source, verification.source),
        eq(bgTaskEvidenceRecords.sourceEvidenceId, verification.sourceEvidenceId)
      ))
      .limit(1);

    if (bySourceEvidence) {
      if (bySourceEvidence.canonicalUserId !== verification.canonicalUserId) {
        throw new BgTaskEvidencePersistenceError(
          "SOURCE_EVIDENCE_REPLAY",
          "This source evidence has already been attributed to another account."
        );
      }
      throw new BgTaskEvidencePersistenceError(
        "SOURCE_EVIDENCE_CONFLICT",
        "This source evidence is already bound to a different task completion."
      );
    }

    throw new BgTaskEvidencePersistenceError(
      "PERSISTENCE_INTEGRITY_ERROR",
      "The evidence insert conflicted but no matching immutable evidence record was found."
    );
  });
}
