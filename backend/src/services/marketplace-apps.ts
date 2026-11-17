import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  apps,
  appListingRevisions,
  appListingRevisionCategories,
  appListingPlatformTargets,
  auditEvents,
  categories,
  developerMemberships,
  developers
} from "../db/marketplace-schema.js";
import { createUuidV7 } from "../identity/ids.js";

export type MarketplaceAppRole = "owner" | "admin" | "release_manager" | "analyst" | "support_readonly";
export type AppPlatform = "android" | "ios" | "web" | "windows" | "macos" | "linux";

export class MarketplaceAppError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT", message: string) {
    super(message);
    this.name = "MarketplaceAppError";
  }
}

function invalid(message: string): never {
  throw new MarketplaceAppError("INVALID_INPUT", message);
}

function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 140 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    invalid("App slug must be 3–140 lowercase letters, numbers or single hyphens.");
  }
  return slug;
}

function normalizeLocale(value: string): string {
  const locale = value.trim().replace(/_/g, "-");
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) || locale.length > 35) {
    invalid("A valid BCP 47 locale is required.");
  }
  return locale.split("-").map((part, index) =>
    index === 0 ? part.toLowerCase() : part.length === 2 ? part.toUpperCase() : part
  ).join("-");
}

function httpsUrl(value: string | null | undefined, label: string): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) invalid(label + " must be a valid HTTPS URL.");
    return parsed.toString();
  } catch {
    invalid(label + " must be a valid HTTPS URL.");
  }
}

async function checksum(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function audit(input: { actorId: string; action: string; targetType: string; targetId: string; now: Date; metadata?: Record<string, unknown> }) {
  return {
    id: createUuidV7(input.now.getTime()),
    actorCanonicalUserId: input.actorId,
    actorType: "user" as const,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    correlationId: input.targetId,
    metadata: input.metadata ?? {},
    createdAt: input.now
  };
}

async function requireOrganizationRole(
  db: Parameters<Parameters<Database["transaction"]>[0]>[0] | Database,
  developerId: string,
  actorId: string,
  roles: MarketplaceAppRole[]
) {
  const [membership] = await db.select({ role: developerMemberships.role, status: developerMemberships.status })
    .from(developerMemberships)
    .where(and(
      eq(developerMemberships.developerId, developerId),
      eq(developerMemberships.canonicalUserId, actorId),
      eq(developerMemberships.status, "active")
    ))
    .limit(1);
  if (!membership) throw new MarketplaceAppError("NOT_FOUND", "Developer organization was not found.");
  if (!roles.includes(membership.role as MarketplaceAppRole)) {
    throw new MarketplaceAppError("FORBIDDEN", "You do not have permission to manage apps in this organization.");
  }
}

function validatePlatforms(platforms: AppPlatform[]) {
  const allowed = new Set<AppPlatform>(["android", "ios", "web", "windows", "macos", "linux"]);
  if (!platforms.length || platforms.length > 6 || new Set(platforms).size !== platforms.length || platforms.some((p) => !allowed.has(p))) {
    invalid("Select one or more supported platforms without duplicates.");
  }
}

function validateCategories(categoryIds: string[]) {
  if (categoryIds.length > 3 || new Set(categoryIds).size !== categoryIds.length) {
    invalid("An app may select up to three categories without duplicates.");
  }
}

export interface AppLocalizationInput {
  locale: string;
  name: string;
  tagline?: string | null;
  description: string;
  websiteUrl?: string | null;
  privacyPolicyUrl?: string | null;
  supportUrl?: string | null;
}

export interface CreateMarketplaceAppInput {
  developerId: string;
  actorCanonicalUserId: string;
  slug: string;
  appType: "app" | "game";
  localizations: AppLocalizationInput[];
  categoryIds?: string[];
  platforms: AppPlatform[];
  now?: Date;
}

function normalizeLocalization(input: AppLocalizationInput) {
  const locale = normalizeLocale(input.locale);
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name || name.length > 160) invalid("App name must contain 1–160 characters.");
  if (!description || description.length > 20000) invalid("Description must contain 1–20,000 characters.");
  const tagline = input.tagline?.trim() || null;
  if (tagline && tagline.length > 240) invalid("Tagline must be 240 characters or fewer.");
  return {
    locale, name, tagline, description,
    websiteUrl: httpsUrl(input.websiteUrl, "Website URL"),
    privacyPolicyUrl: httpsUrl(input.privacyPolicyUrl, "Privacy policy URL"),
    supportUrl: httpsUrl(input.supportUrl, "Support URL")
  };
}

async function validateActiveCategories(db: Parameters<Parameters<Database["transaction"]>[0]>[0] | Database, categoryIds: string[]) {
  validateCategories(categoryIds);
  if (!categoryIds.length) return;
  const found = await db.select({ id: categories.id }).from(categories)
    .where(and(inArray(categories.id, categoryIds), eq(categories.status, "active")));
  if (found.length !== categoryIds.length) invalid("One or more selected categories are unavailable.");
}

export async function createMarketplaceApp(db: Database, input: CreateMarketplaceAppInput) {
  const now = input.now ?? new Date();
  const slug = normalizeSlug(input.slug);
  if (input.appType !== "app" && input.appType !== "game") invalid("App type must be app or game.");
  if (!input.localizations.length || input.localizations.length > 8) invalid("Provide between one and eight localized listings.");
  const localizations = input.localizations.map(normalizeLocalization);
  if (new Set(localizations.map((item) => item.locale)).size !== localizations.length) invalid("Each locale may appear only once.");
  const platforms = [...input.platforms];
  validatePlatforms(platforms);
  const categoryIds = input.categoryIds ?? [];
  validateCategories(categoryIds);
  const appId = createUuidV7(now.getTime());
  const revisionIds = localizations.map(() => createUuidV7(now.getTime()));
  return db.transaction(async (tx) => {
    const [organization] = await tx.select({ id: developers.id, status: developers.status })
      .from(developers).where(eq(developers.id, input.developerId)).for("update").limit(1);
    if (!organization || organization.status === "suspended" || organization.status === "closed") {
      throw new MarketplaceAppError("NOT_FOUND", "Developer organization was not found.");
    }
    await requireOrganizationRole(tx, input.developerId, input.actorCanonicalUserId, ["owner", "admin", "release_manager"]);
    await validateActiveCategories(tx, categoryIds);
    const [app] = await tx.insert(apps).values({
      id: appId, developerId: input.developerId, slug, appType: input.appType,
      status: "draft", createdByCanonicalUserId: input.actorCanonicalUserId,
      createdAt: now, updatedAt: now
    }).returning();
    if (!app) throw new Error("App draft creation returned no row.");

    for (let index = 0; index < localizations.length; index += 1) {
      const item = localizations[index]!;
      const revisionId = revisionIds[index]!;
      const metadata = { ...item, categoryIds: [...categoryIds].sort(), platforms: [...platforms].sort() };
      await tx.insert(appListingRevisions).values({
        id: revisionId, appId, revisionNumber: 1, contentLocale: item.locale,
        name: item.name, tagline: item.tagline, description: item.description,
        websiteUrl: item.websiteUrl, privacyPolicyUrl: item.privacyPolicyUrl,
        supportUrl: item.supportUrl, privacyDisclosure: {},
        metadataChecksum: await checksum(metadata), status: "draft",
        createdAt: now, updatedAt: now
      });
      if (categoryIds.length) {
        await tx.insert(appListingRevisionCategories).values(categoryIds.map((categoryId) => ({ revisionId, categoryId })));
      }
      await tx.insert(appListingPlatformTargets).values(platforms.map((platform) => ({
        id: createUuidV7(now.getTime()), revisionId, platform,
        architecture: "universal", availabilityStatus: "available"
      })));
    }

    await tx.insert(auditEvents).values(audit({
      actorId: input.actorCanonicalUserId, action: "app.draft.created",
      targetType: "app", targetId: appId, now,
      metadata: { developerId: input.developerId, slug, appType: input.appType, locales: localizations.map((item) => item.locale) }
    }));
    return { id: appId, developerId: input.developerId, slug, appType: input.appType, status: "draft", createdAt: now };
  });
}

export async function listMarketplaceApps(db: Database, input: { developerId: string; actorCanonicalUserId: string }) {
  await requireOrganizationRole(db, input.developerId, input.actorCanonicalUserId, ["owner", "admin", "release_manager", "analyst", "support_readonly"]);
  const rows = await db.select({
    id: apps.id, slug: apps.slug, appType: apps.appType, status: apps.status,
    createdAt: apps.createdAt, updatedAt: apps.updatedAt,
    locale: appListingRevisions.contentLocale, name: appListingRevisions.name,
    revisionStatus: appListingRevisions.status, revisionNumber: appListingRevisions.revisionNumber
  }).from(apps).leftJoin(appListingRevisions, eq(appListingRevisions.appId, apps.id))
    .where(eq(apps.developerId, input.developerId))
    .orderBy(desc(apps.updatedAt), asc(apps.id), asc(appListingRevisions.contentLocale), desc(appListingRevisions.revisionNumber))
    .limit(800);
  const grouped = new Map<string, {
    id: string; slug: string; appType: string; status: string; createdAt: Date; updatedAt: Date;
    localizations: Array<{ locale: string; name: string; status: string; revisionNumber: number }>;
  }>();
  const seenLocales = new Set<string>();
  for (const row of rows) {
    let app = grouped.get(row.id);
    if (!app) {
      app = { id: row.id, slug: row.slug, appType: row.appType, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt, localizations: [] };
      grouped.set(row.id, app);
    }
    if (row.locale) {
      const key = row.id + ":" + row.locale;
      if (!seenLocales.has(key)) {
        seenLocales.add(key);
        app.localizations.push({ locale: row.locale, name: row.name ?? "", status: row.revisionStatus ?? "draft", revisionNumber: row.revisionNumber ?? 1 });
      }
    }
  }
  return [...grouped.values()].slice(0, 100);
}

export async function getMarketplaceApp(db: Database, input: { developerId: string; appId: string; actorCanonicalUserId: string }) {
  await requireOrganizationRole(db, input.developerId, input.actorCanonicalUserId, ["owner", "admin", "release_manager", "analyst", "support_readonly"]);
  const [app] = await db.select({
    id: apps.id, developerId: apps.developerId, slug: apps.slug, appType: apps.appType,
    status: apps.status, slugLockedAt: apps.slugLockedAt, createdAt: apps.createdAt, updatedAt: apps.updatedAt
  }).from(apps).where(and(eq(apps.id, input.appId), eq(apps.developerId, input.developerId))).limit(1);
  if (!app) throw new MarketplaceAppError("NOT_FOUND", "App was not found.");
  const revisions = await db.select().from(appListingRevisions)
    .where(eq(appListingRevisions.appId, input.appId))
    .orderBy(asc(appListingRevisions.contentLocale), desc(appListingRevisions.revisionNumber));
  const revisionIds = revisions.map((revision) => revision.id);
  const [categoryRows, platformRows] = revisionIds.length ? await Promise.all([
    db.select({ revisionId: appListingRevisionCategories.revisionId, id: categories.id, slug: categories.slug })
      .from(appListingRevisionCategories).innerJoin(categories, eq(appListingRevisionCategories.categoryId, categories.id))
      .where(inArray(appListingRevisionCategories.revisionId, revisionIds)),
    db.select({ revisionId: appListingPlatformTargets.revisionId, platform: appListingPlatformTargets.platform })
      .from(appListingPlatformTargets).where(inArray(appListingPlatformTargets.revisionId, revisionIds))
  ]) : [[], []];
  const localizations = revisions.map((revision) => ({
    id: revision.id, revisionNumber: revision.revisionNumber, locale: revision.contentLocale,
    name: revision.name, tagline: revision.tagline, description: revision.description,
    websiteUrl: revision.websiteUrl, privacyPolicyUrl: revision.privacyPolicyUrl,
    supportUrl: revision.supportUrl, status: revision.status,
    categories: categoryRows.filter((row) => row.revisionId === revision.id).map(({ id, slug }) => ({ id, slug })),
    platforms: platformRows.filter((row) => row.revisionId === revision.id).map((row) => row.platform)
  }));
  return { ...app, localizations };
}

export async function updateMarketplaceAppDraft(db: Database, input: {
  developerId: string; appId: string; actorCanonicalUserId: string;
  locale: string; listing: Omit<AppLocalizationInput, "locale">;
  categoryIds?: string[]; platforms?: AppPlatform[]; slug?: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  const locale = normalizeLocale(input.locale);
  const listing = normalizeLocalization({ locale, ...input.listing });
  const categoryIds = input.categoryIds;
  if (input.platforms) validatePlatforms(input.platforms);
  const nextSlug = input.slug === undefined ? undefined : normalizeSlug(input.slug);

  return db.transaction(async (tx) => {
    const [organization] = await tx.select({ id: developers.id, status: developers.status }).from(developers)
      .where(eq(developers.id, input.developerId)).for("update").limit(1);
    if (!organization || organization.status === "suspended" || organization.status === "closed") {
      throw new MarketplaceAppError("NOT_FOUND", "Developer organization was not found.");
    }
    await requireOrganizationRole(tx, input.developerId, input.actorCanonicalUserId, ["owner", "admin", "release_manager"]);
    if (categoryIds) await validateActiveCategories(tx, categoryIds);
    const [app] = await tx.select().from(apps).where(and(
      eq(apps.id, input.appId), eq(apps.developerId, input.developerId)
    )).for("update").limit(1);
    if (!app) throw new MarketplaceAppError("NOT_FOUND", "App was not found.");
    if (app.status !== "draft") throw new MarketplaceAppError("CONFLICT", "Only draft apps can be edited in this workflow.");
    if (nextSlug && app.slugLockedAt) throw new MarketplaceAppError("CONFLICT", "The app slug is locked after first publication.");

    const [revision] = await tx.select().from(appListingRevisions).where(and(
      eq(appListingRevisions.appId, input.appId),
      eq(appListingRevisions.contentLocale, locale),
      eq(appListingRevisions.status, "draft")
    )).orderBy(desc(appListingRevisions.revisionNumber)).for("update").limit(1);
    if (!revision) throw new MarketplaceAppError("NOT_FOUND", "An editable draft for this locale was not found.");
    const [existingCategories, existingPlatforms] = await Promise.all([
      tx.select({ categoryId: appListingRevisionCategories.categoryId }).from(appListingRevisionCategories)
        .where(eq(appListingRevisionCategories.revisionId, revision.id)),
      tx.select({ platform: appListingPlatformTargets.platform }).from(appListingPlatformTargets)
        .where(eq(appListingPlatformTargets.revisionId, revision.id))
    ]);
    const metadata = {
      ...listing,
      categoryIds: [...(categoryIds ?? existingCategories.map((row) => row.categoryId))].sort(),
      platforms: [...(input.platforms ?? existingPlatforms.map((row) => row.platform as AppPlatform))].sort()
    };
    await tx.update(appListingRevisions).set({
      name: listing.name, tagline: listing.tagline, description: listing.description,
      websiteUrl: listing.websiteUrl, privacyPolicyUrl: listing.privacyPolicyUrl,
      supportUrl: listing.supportUrl, metadataChecksum: await checksum(metadata), updatedAt: now
    }).where(eq(appListingRevisions.id, revision.id));

    if (categoryIds) {
      await tx.delete(appListingRevisionCategories).where(eq(appListingRevisionCategories.revisionId, revision.id));
      if (categoryIds.length) await tx.insert(appListingRevisionCategories).values(categoryIds.map((categoryId) => ({ revisionId: revision.id, categoryId })));
    }
    if (input.platforms) {
      await tx.delete(appListingPlatformTargets).where(eq(appListingPlatformTargets.revisionId, revision.id));
      await tx.insert(appListingPlatformTargets).values(input.platforms.map((platform) => ({
        id: createUuidV7(now.getTime()), revisionId: revision.id, platform,
        architecture: "universal", availabilityStatus: "available"
      })));
    }
    if (nextSlug && nextSlug !== app.slug) {
      await tx.update(apps).set({ slug: nextSlug, aggregateVersion: app.aggregateVersion + 1, updatedAt: now })
        .where(eq(apps.id, input.appId));
    } else {
      await tx.update(apps).set({ aggregateVersion: app.aggregateVersion + 1, updatedAt: now })
        .where(eq(apps.id, input.appId));
    }
    await tx.insert(auditEvents).values(audit({
      actorId: input.actorCanonicalUserId, action: "app.draft.updated",
      targetType: "app", targetId: input.appId, now,
      metadata: { locale, changedCategories: Boolean(categoryIds), changedPlatforms: Boolean(input.platforms), slugChanged: Boolean(nextSlug && nextSlug !== app.slug) }
    }));
    return { appId: input.appId, revisionId: revision.id, locale, updatedAt: now };
  });
}
