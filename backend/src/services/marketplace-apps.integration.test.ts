import assert from "node:assert/strict";
import test from "node:test";
import { Pool as PgPool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { schema } from "../db/schema.js";
import {
  apps, appListingRevisions, auditEvents, marketplaceSchema
} from "../db/marketplace-schema.js";
import { createUuidV7 } from "../identity/ids.js";
import { createDeveloperOrganization } from "./marketplace-developers.js";
import {
  createMarketplaceApp, getMarketplaceApp, listMarketplaceApps, updateMarketplaceAppDraft,
  MarketplaceAppError
} from "./marketplace-apps.js";

const connectionString = process.env.LOCAL_DATABASE_URL;

test("Marketplace app draft transactions enforce tenant access, localization and draft-only edits", {
  skip: !connectionString ? "LOCAL_DATABASE_URL is not configured; PostgreSQL integration test skipped." : false
}, async () => {
  const pool = new PgPool({ connectionString });
  const db = drizzle(pool, { schema: { ...schema, ...marketplaceSchema } }) as unknown as Database;
  async function addUser() {
    const id = createUuidV7();
    await pool.query("INSERT INTO public.canonical_users (id) VALUES ($1)", [id]);
    return id;
  }
  try {
    await pool.query("SELECT 1 FROM marketplace.apps LIMIT 0");
    const ownerId = await addUser();
    const outsiderId = await addUser();
    const organization = await createDeveloperOrganization(db, {
      actorCanonicalUserId: ownerId,
      slug: "app-draft-" + ownerId.slice(-8),
      displayName: "App Draft Publisher"
    });
    const created = await createMarketplaceApp(db, {
      developerId: organization.id,
      actorCanonicalUserId: ownerId,
      slug: "sample-game-" + ownerId.slice(-8),
      appType: "game",
      platforms: ["android", "ios"],
      localizations: [
        { locale: "en", name: "Sample Game", description: "English description." },
        { locale: "zh-CN", name: "示例游戏", description: "简体中文介绍。" }
      ]
    });
    assert.equal(created.status, "draft");
    await assert.rejects(
      () => createMarketplaceApp(db, {
        developerId: organization.id, actorCanonicalUserId: ownerId,
        slug: created.slug, appType: "app", platforms: ["web"],
        localizations: [{ locale: "en", name: "Duplicate", description: "Duplicate slug should fail." }]
      }),
      (error: unknown) => error instanceof MarketplaceAppError && error.code === "CONFLICT"
    );

    const detail = await getMarketplaceApp(db, {
      developerId: organization.id, appId: created.id, actorCanonicalUserId: ownerId
    });
    assert.equal(detail.localizations.length, 2);
    assert.deepEqual(detail.localizations.map((item) => item.locale), ["en", "zh-CN"]);

    const list = await listMarketplaceApps(db, {
      developerId: organization.id, actorCanonicalUserId: ownerId
    });
    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, created.id);

    await assert.rejects(
      () => getMarketplaceApp(db, { developerId: organization.id, appId: created.id, actorCanonicalUserId: outsiderId }),
      (error: unknown) => error instanceof MarketplaceAppError && error.code === "NOT_FOUND"
    );

    const updated = await updateMarketplaceAppDraft(db, {
      developerId: organization.id, appId: created.id, actorCanonicalUserId: ownerId,
      locale: "zh-CN",
      listing: { name: "示例游戏 2", description: "更新后的中文介绍。" }
    });
    assert.equal(updated.locale, "zh-CN");
    const [zhRevision] = await db.select().from(appListingRevisions).where(and(
      eq(appListingRevisions.appId, created.id), eq(appListingRevisions.contentLocale, "zh-CN")
    ));
    assert.equal(zhRevision?.name, "示例游戏 2");

    await pool.query("UPDATE marketplace.apps SET status = 'published', slug_locked_at = now(), published_at = now() WHERE id = $1", [created.id]);
    await assert.rejects(
      () => updateMarketplaceAppDraft(db, {
        developerId: organization.id, appId: created.id, actorCanonicalUserId: ownerId,
        locale: "zh-CN", slug: "changed-after-publish",
        listing: { name: "Not allowed", description: "Cannot edit a published app using draft endpoint." }
      }),
      (error: unknown) => error instanceof MarketplaceAppError && error.code === "CONFLICT"
    );
    const events = await db.select().from(auditEvents).where(and(
      eq(auditEvents.targetType, "app"), eq(auditEvents.targetId, created.id)
    ));
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((event) => event.action).sort(), ["app.draft.created", "app.draft.updated"]);
    const [storedApp] = await db.select().from(apps).where(eq(apps.id, created.id));
    assert.equal(storedApp?.slugLockedAt instanceof Date, true);
  } finally {
    await pool.end();
  }
});
