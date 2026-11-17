import assert from "node:assert/strict";
import test from "node:test";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "../db/client.js";
import { canonicalUsers, schema } from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import {
  BgTaskVerifierRegistry,
  verifyBgTaskCompletion,
  type BgTaskEvidence,
  type BgTaskVerifier
} from "./bg-task-verifier.js";
import {
  BgTaskEvidencePersistenceError,
  persistBgTaskEvidence
} from "./bg-task-evidence-service.js";

const connectionString = process.env.LOCAL_DATABASE_URL;

test("BG task evidence persistence is atomic, idempotent and blocks cross-user source replay in PostgreSQL", {
  skip: !connectionString ? "LOCAL_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async (t) => {
  const pool = new PgPool({ connectionString });
  const db = drizzle(pool, { schema }) as unknown as Database;
  const now = new Date("2026-11-18T12:00:00.000Z");
  const firstUserId = createUuidV7(now.getTime());
  const secondUserId = createUuidV7(now.getTime());
  const sourceEvidenceId = `ci-evidence-${createUuidV7(now.getTime()).slice(-8)}`;
  const evidence: BgTaskEvidence = {
    evidenceId: sourceEvidenceId,
    source: "brightglobe.ci",
    issuer: "brightglobe-server",
    canonicalUserId: firstUserId,
    taskId: "ci-task-evidence-persistence",
    taskVersion: 1,
    occurredAt: new Date("2026-11-18T11:30:00.000Z"),
    digestSha256: "b".repeat(64)
  };
  const verifier: BgTaskVerifier = {
    key: "ci-task-evidence-v1",
    maxEvidenceAgeMs: 60 * 60 * 1000,
    reviewMode: "automatic",
    repeatable: false,
    verify: async () => evidence
  };
  const registry = new BgTaskVerifierRegistry([verifier]);
  const firstVerification = await verifyBgTaskCompletion(registry, {
    canonicalUserId: firstUserId,
    taskId: evidence.taskId,
    taskVersion: evidence.taskVersion,
    verifierKey: verifier.key
  }, now);

  try {
    await db.insert(canonicalUsers).values([
      { id: firstUserId, status: "active", createdAt: now, updatedAt: now },
      { id: secondUserId, status: "active", createdAt: now, updatedAt: now }
    ]);

    await t.test("persists server verification as pending_review, never auto-approves", async () => {
      const result = await persistBgTaskEvidence(db, firstVerification, now);
      assert.equal(result.outcome, "persisted");
      assert.equal(result.status, "pending_review");
      assert.equal(result.canonicalUserId, firstUserId);
      assert.equal(result.sourceEvidenceId, sourceEvidenceId);
    });

    await t.test("same idempotency key returns the original immutable evidence", async () => {
      const [first] = await Promise.all([
        persistBgTaskEvidence(db, firstVerification, now),
        persistBgTaskEvidence(db, firstVerification, now)
      ]);
      const replay = await persistBgTaskEvidence(db, firstVerification, now);
      assert.equal(first.evidenceId, replay.evidenceId);
      assert.equal(replay.outcome, "replayed");
      assert.equal(replay.status, "pending_review");
    });

    await t.test("same source evidence cannot be replayed by another canonical user", async () => {
      const secondVerification = await verifyBgTaskCompletion(
        new BgTaskVerifierRegistry([{
          ...verifier,
          verify: async () => ({ ...evidence, canonicalUserId: secondUserId })
        }]),
        {
          canonicalUserId: secondUserId,
          taskId: evidence.taskId,
          taskVersion: evidence.taskVersion,
          verifierKey: verifier.key
        },
        now
      );
      await assert.rejects(
        () => persistBgTaskEvidence(db, secondVerification, now),
        (error: unknown) => error instanceof BgTaskEvidencePersistenceError && error.code === "SOURCE_EVIDENCE_REPLAY"
      );
    });

    await t.test("same idempotency key cannot be rebound to different proof", async () => {
      const changedProof = {
        ...firstVerification,
        evidenceDigest: "c".repeat(64),
        sourceEvidenceId: "different-source-id"
      };
      await assert.rejects(
        () => persistBgTaskEvidence(db, changedProof, now),
        (error: unknown) => error instanceof BgTaskEvidencePersistenceError && error.code === "IDEMPOTENCY_CONFLICT"
      );
    });
  } finally {
    await pool.end();
  }
});
