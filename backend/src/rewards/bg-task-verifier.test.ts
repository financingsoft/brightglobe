import assert from "node:assert/strict";
import test from "node:test";
import {
  BgTaskVerifierError,
  BgTaskVerifierRegistry,
  verifyBgTaskCompletion,
  type BgTaskEvidence,
  type BgTaskVerifier
} from "./bg-task-verifier.js";

const canonicalUserId = "01933f5e-7b00-7000-8000-000000000001";
const now = new Date("2026-11-17T12:00:00.000Z");
const validEvidence: BgTaskEvidence = {
  evidenceId: "activity-123",
  source: "brightglobe.activity",
  issuer: "brightglobe-server",
  canonicalUserId,
  taskId: "task-profile-complete",
  taskVersion: 2,
  occurredAt: new Date("2026-11-17T11:00:00.000Z"),
  digestSha256: "a".repeat(64)
};

function verifier(overrides: Partial<BgTaskVerifier> = {}): BgTaskVerifier {
  return {
    key: "profile-complete-v1",
    maxEvidenceAgeMs: 24 * 60 * 60 * 1000,
    reviewMode: "automatic",
    repeatable: false,
    verify: async () => validEvidence,
    ...overrides
  };
}

const request = {
  canonicalUserId,
  taskId: "task-profile-complete",
  taskVersion: 2,
  verifierKey: "profile-complete-v1"
};

test("does not allow task claims without a registered server verifier", async () => {
  await assert.rejects(
    () => verifyBgTaskCompletion(new BgTaskVerifierRegistry(), request, now),
    (error: unknown) => error instanceof BgTaskVerifierError && error.code === "VERIFIER_NOT_REGISTERED"
  );
});

test("produces stable task idempotency key from server-verified evidence", async () => {
  const registry = new BgTaskVerifierRegistry([verifier()]);
  const first = await verifyBgTaskCompletion(registry, request, now);
  const second = await verifyBgTaskCompletion(registry, request, now);
  assert.equal(first.outcome, "verified");
  assert.deepEqual(first, second);
  assert.equal(first.idempotencyKey, `bg-task:${canonicalUserId}:task-profile-complete:2`);
});

test("requires explicit manual review when configured by the verifier", async () => {
  const result = await verifyBgTaskCompletion(
    new BgTaskVerifierRegistry([verifier({ reviewMode: "manual" })]),
    request,
    now
  );
  assert.equal(result.outcome, "review_required");
});

test("uses evidence instance in idempotency key only for repeatable tasks", async () => {
  const result = await verifyBgTaskCompletion(
    new BgTaskVerifierRegistry([verifier({ repeatable: true })]),
    request,
    now
  );
  assert.equal(result.idempotencyKey, `bg-task:${canonicalUserId}:task-profile-complete:2:activity-123`);
});

test("rejects evidence for another user, task or task version", async () => {
  for (const changed of [
    { canonicalUserId: "01933f5e-7b00-7000-8000-000000000002" },
    { taskId: "another-task" },
    { taskVersion: 3 }
  ]) {
    const badVerifier = verifier({ verify: async () => ({ ...validEvidence, ...changed }) });
    await assert.rejects(
      () => verifyBgTaskCompletion(new BgTaskVerifierRegistry([badVerifier]), request, now),
      (error: unknown) => error instanceof BgTaskVerifierError && error.code === "EVIDENCE_INVALID"
    );
  }
});

test("rejects future, stale and malformed evidence", async () => {
  const invalidEvidence = [
    { ...validEvidence, occurredAt: new Date("2026-11-17T12:01:00.000Z") },
    { ...validEvidence, occurredAt: new Date("2026-11-15T00:00:00.000Z") },
    { ...validEvidence, digestSha256: "not-a-digest" },
    { ...validEvidence, issuer: "client" as BgTaskEvidence["issuer"] }
  ];
  for (const evidence of invalidEvidence) {
    await assert.rejects(
      () => verifyBgTaskCompletion(
        new BgTaskVerifierRegistry([verifier({ verify: async () => evidence })]),
        request,
        now
      ),
      (error: unknown) => error instanceof BgTaskVerifierError && error.code === "EVIDENCE_INVALID"
    );
  }
});

test("does not convert verifier outages into successful or rejected task evidence", async () => {
  await assert.rejects(
    () => verifyBgTaskCompletion(
      new BgTaskVerifierRegistry([verifier({ verify: async () => { throw new Error("upstream detail"); } })]),
      request,
      now
    ),
    (error: unknown) => error instanceof BgTaskVerifierError && error.code === "VERIFIER_UNAVAILABLE" && !error.message.includes("upstream detail")
  );
});

test("rejects duplicate verifier keys and unsafe verifier policies", () => {
  assert.throws(
    () => new BgTaskVerifierRegistry([verifier(), verifier()]),
    (error: unknown) => error instanceof BgTaskVerifierError && error.code === "INVALID_REQUEST"
  );
  assert.throws(
    () => new BgTaskVerifierRegistry([verifier({ maxEvidenceAgeMs: 0 })]),
    (error: unknown) => error instanceof BgTaskVerifierError && error.code === "INVALID_REQUEST"
  );
});

test("treats a trusted verifier's explicit no-evidence response as not eligible", async () => {
  const result = await verifyBgTaskCompletion(
    new BgTaskVerifierRegistry([verifier({ verify: async () => null })]),
    request,
    now
  );
  assert.deepEqual(result, { outcome: "not_eligible", verifierKey: "profile-complete-v1" });
});
