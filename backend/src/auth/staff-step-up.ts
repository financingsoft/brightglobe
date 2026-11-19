import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { staffStepUpGrants } from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";

export const STAFF_STEP_UP_TTL_MS = 5 * 60 * 1000;

export type StaffStepUpOperation =
  | "bg.treasury.recovery.propose"
  | "bg.treasury.recovery.approve";

interface StaffStepUpBinding {
  staffPrincipalId: string;
  authUserId: string;
  sessionId: string;
  operation: StaffStepUpOperation;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

/**
 * Issues a five-minute, session-bound, action-bound, single-use grant.
 * Callers must invoke this only after the Better Auth TOTP endpoint succeeds.
 * The plaintext token is returned once; only its SHA-256 digest is persisted.
 */
export async function issueStaffStepUpGrant(
  db: Database,
  binding: StaffStepUpBinding,
  now = new Date()
): Promise<{ token: string; expiresAt: Date }> {
  if (!binding.staffPrincipalId || !binding.authUserId || !binding.sessionId || Number.isNaN(now.getTime())) {
    throw new Error("A valid staff, user, session, and issuance time are required.");
  }

  const token = createOpaqueToken();
  const expiresAt = new Date(now.getTime() + STAFF_STEP_UP_TTL_MS);
  await db.insert(staffStepUpGrants).values({
    id: createUuidV7(now.getTime()),
    ...binding,
    tokenHash: await sha256(token),
    issuedAt: now,
    expiresAt
  });

  return { token, expiresAt };
}

/**
 * Atomically consumes a grant. A token cannot be replayed, moved between
 * sessions, staff identities, or operation types, or used after expiry.
 */
export async function consumeStaffStepUpGrant(
  db: Database,
  binding: StaffStepUpBinding & { token: string },
  now = new Date()
): Promise<boolean> {
  if (!binding.token || Number.isNaN(now.getTime())) return false;

  const tokenHash = await sha256(binding.token);
  const consumed = await db.update(staffStepUpGrants)
    .set({ consumedAt: now })
    .where(and(
      eq(staffStepUpGrants.tokenHash, tokenHash),
      eq(staffStepUpGrants.staffPrincipalId, binding.staffPrincipalId),
      eq(staffStepUpGrants.authUserId, binding.authUserId),
      eq(staffStepUpGrants.sessionId, binding.sessionId),
      eq(staffStepUpGrants.operation, binding.operation),
      gt(staffStepUpGrants.expiresAt, now),
      isNull(staffStepUpGrants.consumedAt)
    ))
    .returning({ id: staffStepUpGrants.id });

  return consumed.length === 1;
}
