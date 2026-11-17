import { isUuidV7 } from "../identity/ids.js";

export type BgTaskEvidence = {
  evidenceId: string;
  source: string;
  issuer: "brightglobe-server" | "trusted-provider";
  canonicalUserId: string;
  taskId: string;
  taskVersion: number;
  occurredAt: Date;
  digestSha256: string;
};

export type BgTaskVerifierContext = {
  canonicalUserId: string;
  taskId: string;
  taskVersion: number;
  now: Date;
};

export type BgTaskVerifier = {
  key: string;
  maxEvidenceAgeMs: number;
  reviewMode: "automatic" | "manual";
  repeatable: boolean;
  verify(context: BgTaskVerifierContext): Promise<BgTaskEvidence | null>;
};

export type BgTaskVerification =
  | {
      outcome: "verified" | "review_required";
      verifierKey: string;
      evidenceRef: string;
      evidenceDigest: string;
      occurredAt: string;
      idempotencyKey: string;
    }
  | { outcome: "not_eligible"; verifierKey: string };

export class BgTaskVerifierError extends Error {
  constructor(
    readonly code: "INVALID_REQUEST" | "VERIFIER_NOT_REGISTERED" | "VERIFIER_UNAVAILABLE" | "EVIDENCE_INVALID",
    message: string
  ) {
    super(message);
    this.name = "BgTaskVerifierError";
  }
}

const KEY_PATTERN = /^[a-z][a-z0-9._-]{2,63}$/;
const EVIDENCE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const SOURCE_PATTERN = /^[a-z][a-z0-9._-]{1,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Registry is constructed by trusted backend composition code. It intentionally
 * accepts no client-provided evidence and has no implicit/default verifier.
 */
export class BgTaskVerifierRegistry {
  private readonly verifiers = new Map<string, BgTaskVerifier>();

  constructor(verifiers: readonly BgTaskVerifier[] = []) {
    for (const verifier of verifiers) {
      if (!KEY_PATTERN.test(verifier.key)) {
        throw new BgTaskVerifierError("INVALID_REQUEST", "Task verifier key is invalid.");
      }
      if (this.verifiers.has(verifier.key)) {
        throw new BgTaskVerifierError("INVALID_REQUEST", "Task verifier keys must be unique.");
      }
      if (!Number.isSafeInteger(verifier.maxEvidenceAgeMs) || verifier.maxEvidenceAgeMs <= 0) {
        throw new BgTaskVerifierError("INVALID_REQUEST", "Task verifier evidence age must be positive.");
      }
      this.verifiers.set(verifier.key, verifier);
    }
  }

  get(key: string): BgTaskVerifier | undefined {
    return this.verifiers.get(key);
  }

  keys(): string[] {
    return [...this.verifiers.keys()].sort();
  }
}

/**
 * Runs a server-owned evidence adapter. A successful result is only a verified
 * completion decision; it does not reserve budget, create a payout, or transfer BG.
 */
export async function verifyBgTaskCompletion(
  registry: BgTaskVerifierRegistry,
  input: { canonicalUserId: string; taskId: string; taskVersion: number; verifierKey: string },
  now = new Date()
): Promise<BgTaskVerification> {
  if (
    !isUuidV7(input.canonicalUserId) ||
    input.taskId.trim().length === 0 ||
    input.taskId.length > 128 ||
    !Number.isSafeInteger(input.taskVersion) ||
    input.taskVersion < 1 ||
    !KEY_PATTERN.test(input.verifierKey) ||
    Number.isNaN(now.getTime())
  ) {
    throw new BgTaskVerifierError("INVALID_REQUEST", "A valid canonical user, task version and server timestamp are required.");
  }

  const verifier = registry.get(input.verifierKey);
  if (!verifier) {
    throw new BgTaskVerifierError("VERIFIER_NOT_REGISTERED", "This task has no approved server-side verifier.");
  }

  let evidence: BgTaskEvidence | null;
  try {
    evidence = await verifier.verify({
      canonicalUserId: input.canonicalUserId,
      taskId: input.taskId,
      taskVersion: input.taskVersion,
      now
    });
  } catch {
    throw new BgTaskVerifierError("VERIFIER_UNAVAILABLE", "The task verifier is temporarily unavailable.");
  }

  if (evidence === null) {
    return { outcome: "not_eligible", verifierKey: verifier.key };
  }

  const occurredAt = evidence.occurredAt instanceof Date ? evidence.occurredAt : new Date(Number.NaN);
  const ageMs = now.getTime() - occurredAt.getTime();
  if (
    !EVIDENCE_ID_PATTERN.test(evidence.evidenceId) ||
    !SOURCE_PATTERN.test(evidence.source) ||
    (evidence.issuer !== "brightglobe-server" && evidence.issuer !== "trusted-provider") ||
    evidence.canonicalUserId !== input.canonicalUserId ||
    evidence.taskId !== input.taskId ||
    evidence.taskVersion !== input.taskVersion ||
    !Number.isSafeInteger(evidence.taskVersion) ||
    !SHA256_PATTERN.test(evidence.digestSha256) ||
    Number.isNaN(occurredAt.getTime()) ||
    ageMs < 0 ||
    ageMs > verifier.maxEvidenceAgeMs
  ) {
    throw new BgTaskVerifierError("EVIDENCE_INVALID", "The server verifier returned invalid, mismatched, future or stale evidence.");
  }

  const baseKey = `bg-task:${input.canonicalUserId}:${input.taskId}:${input.taskVersion}`;
  const idempotencyKey = verifier.repeatable ? `${baseKey}:${evidence.evidenceId}` : baseKey;
  if (idempotencyKey.length > 320) {
    throw new BgTaskVerifierError("EVIDENCE_INVALID", "The task idempotency key exceeds the supported length.");
  }

  return {
    outcome: verifier.reviewMode === "manual" ? "review_required" : "verified",
    verifierKey: verifier.key,
    evidenceRef: `task-evidence:${verifier.key}:${evidence.evidenceId}`,
    evidenceDigest: evidence.digestSha256,
    occurredAt: occurredAt.toISOString(),
    idempotencyKey
  };
}
