import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "../db/client.js";
import {
  staffPrincipals,
  staffRoles,
  staffPermissions,
  staffRolePermissions,
  staffRoleAssignments,
  staffAuditEvents,
  schema
} from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";
import { resolveStaffAuthorization, staffHasPermission } from "./staff-authorization.js";

const connectionString = process.env.BG_REWARD_TEST_DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

test("staff RBAC resolves only active, current server-side grants and protects audit history", {
  skip: !connectionString ? "BG_REWARD_TEST_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new PgPool({ connectionString });
  const client = await pool.connect();
  await client.query("BEGIN");
  const db = drizzle(client, { schema }) as unknown as Database;
  const now = new Date("2026-11-19T12:00:00.000Z");
  const authUserId = `staff-rbac-${createUuidV7(now.getTime())}`;
  const principalId = createUuidV7(now.getTime());
  const roleId = createUuidV7(now.getTime());
  const permissionId = createUuidV7(now.getTime());
  const assignmentId = createUuidV7(now.getTime());
  const auditId = createUuidV7(now.getTime());

  try {
    // Keep this fixture compatible with the reward-engine CI user table and the
    // full Better Auth schema by writing only its stable identity columns.
    await client.query(
      'INSERT INTO public."user" (id, name, email) VALUES ($1, $2, $3)',
      [authUserId, "CI Staff", `${authUserId}@example.invalid`]
    );
    await db.insert(staffPrincipals).values({
      id: principalId,
      authUserId,
      status: "active",
      displayLabel: "CI staff principal",
      createdAt: now,
      updatedAt: now
    });
    await db.insert(staffRoles).values({
      id: roleId,
      roleKey: `ci_role_${principalId.slice(-8)}`,
      displayName: "CI role",
      status: "active",
      createdAt: now
    });
    await db.insert(staffPermissions).values({
      id: permissionId,
      permissionKey: `ci.permission.${principalId.slice(-8)}`,
      description: "Integration-test permission",
      createdAt: now
    });
    await db.insert(staffRolePermissions).values({ roleId, permissionId, createdAt: now });
    await db.insert(staffRoleAssignments).values({
      id: assignmentId,
      staffPrincipalId: principalId,
      roleId,
      status: "active",
      validFrom: new Date(now.getTime() - 60_000),
      validUntil: new Date(now.getTime() + 60_000),
      createdAt: now
    });

    const active = await resolveStaffAuthorization(db, authUserId, now);
    assert.equal(active.ok, true);
    if (!active.ok) throw new Error("Expected active staff principal.");
    assert.equal(active.staff.staffPrincipalId, principalId);
    assert.equal(active.staff.permissions.has(`ci.permission.${principalId.slice(-8)}`), true);
    assert.equal(await staffHasPermission(db, authUserId, `ci.permission.${principalId.slice(-8)}`, now), true);

    const outsideWindow = await resolveStaffAuthorization(db, authUserId, new Date(now.getTime() + 120_000));
    assert.equal(outsideWindow.ok, true);
    if (outsideWindow.ok) assert.equal(outsideWindow.staff.permissions.size, 0);

    await db.insert(staffAuditEvents).values({
      id: auditId,
      actorStaffId: principalId,
      subjectStaffId: principalId,
      action: "staff.rbac.integration_test",
      reason: "Verify append-only staff audit protection.",
      metadata: { test: true },
      createdAt: now
    });
    // PostgreSQL aborts the current transaction after a trigger raises. Use
    // savepoints so both UPDATE and DELETE guards are independently exercised.
    await client.query("SAVEPOINT staff_audit_update_guard");
    await assert.rejects(
      () => client.query("UPDATE public.staff_audit_events SET reason = 'tampered' WHERE id = $1", [auditId]),
      /append-only/
    );
    await client.query("ROLLBACK TO SAVEPOINT staff_audit_update_guard");
    await client.query("RELEASE SAVEPOINT staff_audit_update_guard");

    await client.query("SAVEPOINT staff_audit_delete_guard");
    await assert.rejects(
      () => client.query("DELETE FROM public.staff_audit_events WHERE id = $1", [auditId]),
      /append-only/
    );
    await client.query("ROLLBACK TO SAVEPOINT staff_audit_delete_guard");
    await client.query("RELEASE SAVEPOINT staff_audit_delete_guard");

    await db.update(staffPrincipals).set({ status: "suspended" }).where(eq(staffPrincipals.id, principalId));
    const suspended = await resolveStaffAuthorization(db, authUserId, now);
    assert.deepEqual(suspended, { ok: false, reason: "STAFF_INACTIVE" });
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
});
