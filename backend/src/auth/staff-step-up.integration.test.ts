import assert from "node:assert/strict";
import test from "node:test";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "../db/client.js";
import { schema, staffPrincipals, staffStepUpGrants, user } from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import { consumeStaffStepUpGrant, issueStaffStepUpGrant } from "./staff-step-up.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

test("staff step-up grants are hashed, session/action-bound, expiring and single-use", {
  skip: !connectionString ? "BG_REWARD_TEST_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new PgPool({ connectionString });
  const client = await pool.connect();
  await client.query("BEGIN");
  const db = drizzle(client, { schema }) as unknown as Database;
  const now = new Date("2026-11-19T12:00:00.000Z");
  const authUserId = `staff-step-up-${createUuidV7(now.getTime())}`;
  const staffPrincipalId = createUuidV7(now.getTime());

  try {
    await db.insert(user).values({
      id: authUserId,
      name: "CI Step-Up Staff",
      email: `${authUserId}@example.invalid`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now
    });
    await db.insert(staffPrincipals).values({
      id: staffPrincipalId,
      authUserId,
      status: "active",
      displayLabel: "CI step-up principal",
      createdAt: now,
      updatedAt: now
    });

    const binding = {
      staffPrincipalId,
      authUserId,
      sessionId: "ci-session-a",
      operation: "bg.treasury.recovery.approve" as const
    };
    const grant = await issueStaffStepUpGrant(db, binding, now);
    assert.equal(grant.token.length, 64);
    assert.equal(grant.expiresAt.getTime() - now.getTime(), 5 * 60 * 1000);

    const [stored] = await db.select({ tokenHash: staffStepUpGrants.tokenHash })
      .from(staffStepUpGrants);
    assert.notEqual(stored?.tokenHash, grant.token);
    assert.match(stored?.tokenHash ?? "", /^[a-f0-9]{64}$/);

    assert.equal(await consumeStaffStepUpGrant(db, { ...binding, token: grant.token }, now), true);
    assert.equal(await consumeStaffStepUpGrant(db, { ...binding, token: grant.token }, now), false);

    const wrongSessionGrant = await issueStaffStepUpGrant(db, binding, now);
    assert.equal(await consumeStaffStepUpGrant(db, {
      ...binding,
      sessionId: "different-session",
      token: wrongSessionGrant.token
    }, now), false);
    assert.equal(await consumeStaffStepUpGrant(db, {
      ...binding,
      token: wrongSessionGrant.token
    }, now), true);

    const expiredGrant = await issueStaffStepUpGrant(db, binding, now);
    assert.equal(await consumeStaffStepUpGrant(db, {
      ...binding,
      token: expiredGrant.token
    }, new Date(expiredGrant.expiresAt.getTime())), false);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
});
