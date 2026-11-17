import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  bgTaskAppeals,
  bgTaskEvidenceRecords,
  bgTaskReviewDecisions
} from "../db/schema.js";
import { createUuidV7, isUuidV7 } from "../identity/ids.js";

export type BgTaskReviewDecision = "approved" | "rejected";
export type BgTaskReviewScope = "initial" | "appeal";

export type BgTaskReviewAuthorizer = (input: {
  reviewerId: string;
  scope: BgTaskReviewScope;
}) => boolean | Promise<boolean>;

export type BgTaskReviewErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "SELF_REVIEW"
  | "APPEAL_NOT_ALLOWED"
  | "APPEAL_REVIEWER_NOT_INDEPENDENT"
  | "ALREADY_DECIDED"
  | "REVIEW_INTEGRITY_ERROR";

export class BgTaskReviewError extends Error {
  constructor(readonly code: BgTaskReviewErrorCode, message: string) {
    super(message);
    this.name = "BgTaskReviewError";
  }
}

function validateActorAndReason(actorId: string, reason: string, maxLength: number): string {
  if (!isUuidV7(actorId) || typeof reason !== "string") {
    throw new BgTaskReviewError("INVALID_INPUT", "A canonical reviewer/appellant and reason are required.");
  }
  const normalized = reason.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new BgTaskReviewError("INVALID_INPUT", "The reason must be non-empty and within the supported length.");
  }
  return normalized;
}

async function requireAuthorizedReviewer(
  authorize: BgTaskReviewAuthorizer,
  reviewerId: string,
  scope: BgTaskReviewScope
): Promise<void> {
  if (typeof authorize !== "function" || !(await authorize({ reviewerId, scope }))) {
    throw new BgTaskReviewError("FORBIDDEN", "The account is not authorized to review BG task evidence.");
  }
}

/**
 * Records an initial reviewer decision. Authorization is injected by trusted
 * backend composition and must resolve from server-side RBAC, never request data.
 * The database trigger applies the evidence transition and appends the audit event.
 */
export async function recordBgTaskInitialReview(
  db: Database,
  input: {
    evidenceId: string;
    reviewerId: string;
    decision: BgTaskReviewDecision;
    reason: string;
    now?: Date;
  },
  authorize: BgTaskReviewAuthorizer
): Promise<{ decisionId: string; evidenceId: string; decision: BgTaskReviewDecision; status: BgTaskReviewDecision }> {
  const now = input.now ?? new Date();
  const reason = validateActorAndReason(input.reviewerId, input.reason, 1000);
  if (!isUuidV7(input.evidenceId) ||
      (input.decision !== "approved" && input.decision !== "rejected") ||
      Number.isNaN(now.getTime())) {
    throw new BgTaskReviewError("INVALID_INPUT", "A valid evidence ID, decision and timestamp are required.");
  }
  await requireAuthorizedReviewer(authorize, input.reviewerId, "initial");

  return db.transaction(async (tx) => {
    const [evidence] = await tx.select().from(bgTaskEvidenceRecords)
      .where(eq(bgTaskEvidenceRecords.id, input.evidenceId))
      .limit(1)
      .for("update");
    if (!evidence) throw new BgTaskReviewError("NOT_FOUND", "BG task evidence was not found.");
    if (evidence.canonicalUserId === input.reviewerId) {
      throw new BgTaskReviewError("SELF_REVIEW", "A task owner cannot review their own evidence.");
    }
    if (evidence.status !== "pending_review") {
      throw new BgTaskReviewError("INVALID_STATE", "Initial review requires pending_review evidence.");
    }

    const decisionId = createUuidV7(now.getTime());
    try {
      await tx.insert(bgTaskReviewDecisions).values({
        id: decisionId,
        evidenceId: evidence.id,
        decisionType: "initial",
        decision: input.decision,
        reviewerId: input.reviewerId,
        reason,
        createdAt: now
      });
    } catch {
      throw new BgTaskReviewError("ALREADY_DECIDED", "An initial decision already exists or the database rejected this review.");
    }
    return {
      decisionId,
      evidenceId: evidence.id,
      decision: input.decision,
      status: input.decision
    };
  });
}

/**
 * Allows only the canonical task owner to appeal a rejected decision.
 * The migration trigger atomically moves evidence to appealed and audits it.
 */
export async function submitBgTaskAppeal(
  db: Database,
  input: {
    evidenceId: string;
    appellantUserId: string;
    reason: string;
    now?: Date;
  }
): Promise<{ appealId: string; evidenceId: string; status: "open" }> {
  const now = input.now ?? new Date();
  const reason = validateActorAndReason(input.appellantUserId, input.reason, 2000);
  if (!isUuidV7(input.evidenceId) || Number.isNaN(now.getTime())) {
    throw new BgTaskReviewError("INVALID_INPUT", "A valid evidence ID and timestamp are required.");
  }

  return db.transaction(async (tx) => {
    const [evidence] = await tx.select().from(bgTaskEvidenceRecords)
      .where(eq(bgTaskEvidenceRecords.id, input.evidenceId))
      .limit(1)
      .for("update");
    if (!evidence) throw new BgTaskReviewError("NOT_FOUND", "BG task evidence was not found.");
    if (evidence.canonicalUserId !== input.appellantUserId) {
      throw new BgTaskReviewError("FORBIDDEN", "Only the task owner may appeal this evidence.");
    }
    if (evidence.status !== "rejected") {
      throw new BgTaskReviewError("APPEAL_NOT_ALLOWED", "Only rejected task evidence may be appealed.");
    }

    const appealId = createUuidV7(now.getTime());
    try {
      await tx.insert(bgTaskAppeals).values({
        id: appealId,
        evidenceId: evidence.id,
        appellantUserId: input.appellantUserId,
        reason,
        status: "open",
        createdAt: now
      });
    } catch {
      throw new BgTaskReviewError("APPEAL_NOT_ALLOWED", "This evidence cannot receive another appeal.");
    }
    return { appealId, evidenceId: evidence.id, status: "open" };
  });
}

/**
 * Resolves an open appeal. Server-side RBAC is required and the database
 * additionally enforces separation from the initial reviewer.
 */
export async function resolveBgTaskAppeal(
  db: Database,
  input: {
    evidenceId: string;
    reviewerId: string;
    decision: BgTaskReviewDecision;
    reason: string;
    now?: Date;
  },
  authorize: BgTaskReviewAuthorizer
): Promise<{ decisionId: string; evidenceId: string; decision: BgTaskReviewDecision; status: BgTaskReviewDecision }> {
  const now = input.now ?? new Date();
  const reason = validateActorAndReason(input.reviewerId, input.reason, 1000);
  if (!isUuidV7(input.evidenceId) ||
      (input.decision !== "approved" && input.decision !== "rejected") ||
      Number.isNaN(now.getTime())) {
    throw new BgTaskReviewError("INVALID_INPUT", "A valid evidence ID, decision and timestamp are required.");
  }
  await requireAuthorizedReviewer(authorize, input.reviewerId, "appeal");

  return db.transaction(async (tx) => {
    const [evidence] = await tx.select().from(bgTaskEvidenceRecords)
      .where(eq(bgTaskEvidenceRecords.id, input.evidenceId))
      .limit(1)
      .for("update");
    if (!evidence) throw new BgTaskReviewError("NOT_FOUND", "BG task evidence was not found.");
    if (evidence.status !== "appealed") {
      throw new BgTaskReviewError("INVALID_STATE", "Appeal resolution requires appealed evidence.");
    }
    const [appeal] = await tx.select().from(bgTaskAppeals)
      .where(and(
        eq(bgTaskAppeals.evidenceId, evidence.id),
        eq(bgTaskAppeals.status, "open")
      ))
      .limit(1)
      .for("update");
    if (!appeal) throw new BgTaskReviewError("REVIEW_INTEGRITY_ERROR", "Appealed evidence has no open appeal.");

    const [initial] = await tx.select().from(bgTaskReviewDecisions)
      .where(and(
        eq(bgTaskReviewDecisions.evidenceId, evidence.id),
        eq(bgTaskReviewDecisions.decisionType, "initial")
      ))
      .limit(1);
    if (!initial || initial.reviewerId === input.reviewerId) {
      throw new BgTaskReviewError("APPEAL_REVIEWER_NOT_INDEPENDENT", "The appeal reviewer must differ from the initial reviewer.");
    }

    const decisionId = createUuidV7(now.getTime());
    try {
      await tx.insert(bgTaskReviewDecisions).values({
        id: decisionId,
        evidenceId: evidence.id,
        decisionType: "appeal",
        decision: input.decision,
        reviewerId: input.reviewerId,
        reason,
        createdAt: now
      });
    } catch {
      throw new BgTaskReviewError("ALREADY_DECIDED", "This appeal has already been decided or the database rejected the decision.");
    }
    return {
      decisionId,
      evidenceId: evidence.id,
      decision: input.decision,
      status: input.decision
    };
  });
}
