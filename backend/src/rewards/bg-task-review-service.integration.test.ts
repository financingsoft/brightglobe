import assert from "node:assert/strict";
import test from "node:test";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "../db/client.js";
import {
  bgTaskAppeals,
  bgTaskAuditEvents,
  bgTaskEvidenceRecords,
  bgTaskReviewDecisions,
  canonicalUsers,
  schema
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import { persistBgTaskEvidence } from "./bg-task-evidence-service.js";
import {
  BgTaskReviewError,
  recordBgTaskInitialReview,
  resolveBgTaskAppeal,
  submitBgTaskAppeal
} from "./bg-task-review-service.js";
import type { BgTaskVerification } from "./bg-task-verifier.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

test("BG task review and appeal services enforce authorization, ownership and independent review in PostgreSQL", {
  skip: !connectionString ? "BG_REWARD_TEST_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new PgPool({ connectionString });
  const db = drizzle(pool, { schema }) as unknown as Database;
  const now = new Date("2026-11-18T12:00:00.000Z");
  const ownerId = createUuidV7(now.getTime());
  const initialReviewerId = createUuidV7(now.getTime());
  const appealReviewerId = createUuidV7(now.getTime());
  const unauthorizedReviewerId = createUuidV7(now.getTime());
  const evidenceId = createUuidV7(now.getTime());
  const verification: BgTaskVerification = {
    outcome: "verified",
    verifierKey: "ci-task-review-v1",
    canonicalUserId: ownerId,
    taskId: "ci-task-review-appeal",
    taskVersion: 1,
    source: "brightglobe.ci",
    issuer: "brightglobe-server",
    sourceEvidenceId: `review-${evidenceId.slice(-12)}`,
    evidenceRef: `task-evidence:ci-task-review-v1:${evidenceId.slice(-12)}`,
    evidenceDigest: "d".repeat(64),
    occurredAt: new Date(now.getTime() - 60_000).toISOString(),
    idempotencyKey: `bg-task:${ownerId}:ci-task-review-appeal:1`
  };

  try {
    await db.insert(canonicalUsers).values([
      ownerId, initialReviewerId, appealReviewerId, unauthorizedReviewerId
    ].map(id => ({ id, status: "active", createdAt: now, updatedAt: now })));

    const persisted = await persistBgTaskEvidence(db, verification, now);
    const authorizeAll = async () => true;
    const denyAll = async () => false;

    await assert.rejects(
      () => recordBgTaskInitialReview(db, {
        evidenceId: persisted.evidenceId,
        reviewerId: unauthorizedReviewerId,
        decision: "rejected",
        reason: "not authorized",
        now
      }, denyAll),
      (error: unknown) => error instanceof BgTaskReviewError && error.code === "FORBIDDEN"
    );

    await assert.rejects(
      () => recordBgTaskInitialReview(db, {
        evidenceId: persisted.evidenceId,
        reviewerId: ownerId,
        decision: "rejected",
        reason: "owner cannot review",
        now
      }, authorizeAll),
      (error: unknown) => error instanceof BgTaskReviewError && error.code === "SELF_REVIEW"
    );

    const initial = await recordBgTaskInitialReview(db, {
      evidenceId: persisted.evidenceId,
      reviewerId: initialReviewerId,
      decision: "rejected",
      reason: "The required completion evidence was not present.",
      now
    }, authorizeAll);
    assert.equal(initial.status, "rejected");

    const appeal = await submitBgTaskAppeal(db, {
      evidenceId: persisted.evidenceId,
      appellantUserId: ownerId,
      reason: "The provider event was delayed; please review the attached server-side event reference.",
      now: new Date(now.getTime() + 1_000)
    });
    assert.equal(appeal.status, "open");

    await assert.rejects(
      () => resolveBgTaskAppeal(db, {
        evidenceId: persisted.evidenceId,
        reviewerId: initialReviewerId,
        decision: "approved",
        reason: "Attempted same reviewer resolution.",
        now: new Date(now.getTime() + 2_000)
      }, authorizeAll),
      (error: unknown) => error instanceof BgTaskReviewError && error.code === "APPEAL_REVIEWER_NOT_INDEPENDENT"
    );

    await assert.rejects(
      () => submitBgTaskAppeal(db, {
        evidenceId: persisted.evidenceId,
        appellantUserId: appealReviewerId,
        reason: "Not the task owner.",
        now
      }),
      (error: unknown) => error instanceof BgTaskReviewError && error.code === "FORBIDDEN"
    );

    const resolution = await resolveBgTaskAppeal(db, {
      evidenceId: persisted.evidenceId,
      reviewerId: appealReviewerId,
      decision: "approved",
      reason: "Independent review confirmed the trusted source event.",
      now: new Date(now.getTime() + 3_000)
    }, authorizeAll);
    assert.equal(resolution.status, "approved");

    const [finalEvidence] = await db.select().from(bgTaskEvidenceRecords)
      .where((await import("drizzle-orm")).eq(bgTaskEvidenceRecords.id, persisted.evidenceId));
    const [finalAppeal] = await db.select().from(bgTaskAppeals)
      .where((await import("drizzle-orm")).eq(bgTaskAppeals.id, appeal.appealId));
    const decisions = await db.select().from(bgTaskReviewDecisions);
    const audit = await db.select().from(bgTaskAuditEvents)
      .where((await import("drizzle-orm")).eq(bgTaskAuditEvents.evidenceId, persisted.evidenceId));

    assert.equal(finalEvidence?.status, "approved");
    assert.equal(finalAppeal?.status, "resolved");
    assert.equal(finalAppeal?.resolvedBy, appealReviewerId);
    assert.equal(decisions.length, 2);
    assert.ok(audit.some(event => event.action === "task.evidence.initial.rejected"));
    assert.ok(audit.some(event => event.action === "task.evidence.appealed"));
    assert.ok(audit.some(event => event.action === "task.evidence.appeal.approved"));
  } finally {
    await pool.end();
  }
});
