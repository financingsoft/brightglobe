import assert from "node:assert/strict";
import test from "node:test";
import {
  BgTaskEvidencePersistenceError,
  persistBgTaskEvidence
} from "./bg-task-evidence-service.js";
import type { BgTaskVerification } from "./bg-task-verifier.js";

const valid: BgTaskVerification = {
  outcome: "verified",
  verifierKey: "profile-complete-v1",
  canonicalUserId: "01933f5e-7b00-7000-8000-000000000001",
  taskId: "profile-complete",
  taskVersion: 1,
  source: "brightglobe.profile",
  issuer: "brightglobe-server",
  sourceEvidenceId: "profile-event-123",
  evidenceRef: "task-evidence:profile-complete-v1:profile-event-123",
  evidenceDigest: "a".repeat(64),
  occurredAt: "2026-11-18T11:00:00.000Z",
  idempotencyKey: "bg-task:01933f5e-7b00-7000-8000-000000000001:profile-complete:1"
};

test("does not persist a verifier not_eligible result", async () => {
  await assert.rejects(
    () => persistBgTaskEvidence({} as never, { outcome: "not_eligible", verifierKey: "profile-complete-v1" }, new Date("2026-11-18T12:00:00.000Z")),
    (error: unknown) => error instanceof BgTaskEvidencePersistenceError && error.code === "INVALID_VERIFICATION"
  );
});

test("rejects incomplete or malformed trusted verification output before database access", async () => {
  const invalid: BgTaskVerification[] = [
    { ...valid, canonicalUserId: "provider-local-id" },
    { ...valid, taskVersion: 0 },
    { ...valid, source: "Bad Source" },
    { ...valid, issuer: "client" as "brightglobe-server" },
    { ...valid, sourceEvidenceId: "bad id" },
    { ...valid, evidenceDigest: "not-sha256" },
    { ...valid, idempotencyKey: "x".repeat(161) },
    { ...valid, occurredAt: "not-a-date" }
  ];
  for (const result of invalid) {
    await assert.rejects(
      () => persistBgTaskEvidence({} as never, result, new Date("2026-11-18T12:00:00.000Z")),
      (error: unknown) => error instanceof BgTaskEvidencePersistenceError && error.code === "INVALID_VERIFICATION"
    );
  }
});

test("rejects evidence timestamp later than the trusted persistence time", async () => {
  await assert.rejects(
    () => persistBgTaskEvidence({} as never, { ...valid, occurredAt: "2026-11-18T12:01:00.000Z" }, new Date("2026-11-18T12:00:00.000Z")),
    (error: unknown) => error instanceof BgTaskEvidencePersistenceError && error.code === "INVALID_VERIFICATION"
  );
});
