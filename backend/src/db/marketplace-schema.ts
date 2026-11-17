import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { canonicalUsers } from "./schema.js";

/**
 * Globe Play transactional source-of-truth schema.
 *
 * Public anonymous reads must use marketplace public projections in the
 * separate marketplace-api Worker. These tables are never the public read path.
 * IDs are supplied by the application as UUIDv7; no database UUID extension
 * or provider-local Better Auth identifier is used here.
 */
const marketplace = pgSchema("marketplace");

export const developers = marketplace.table("developers", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  description: text("description"),
  websiteUrl: text("website_url"),
  supportEmail: varchar("support_email", { length: 320 }),
  verificationStatus: varchar("verification_status", { length: 24 }).notNull().default("unverified"),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  createdByCanonicalUserId: uuid("created_by_canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  aggregateVersion: bigint("aggregate_version", { mode: "number" }).notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("developers_slug_uidx").on(t.slug),
  index("developers_status_created_idx").on(t.status, t.createdAt),
  check("developers_verification_status_check", sql.raw("verification_status IN ('unverified','pending','verified','rejected','suspended','expired')")),
  check("developers_status_check", sql.raw("status IN ('pending','active','suspended','closed')")),
  check("developers_aggregate_version_check", sql.raw("aggregate_version > 0"))
]);

export const developerMemberships = marketplace.table("developer_memberships", {
  developerId: uuid("developer_id").notNull().references(() => developers.id, { onDelete: "restrict" }),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  role: varchar("role", { length: 24 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("invited"),
  createdByCanonicalUserId: uuid("created_by_canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  primaryKey({ columns: [t.developerId, t.canonicalUserId], name: "developer_memberships_pk" }),
  uniqueIndex("developer_memberships_one_active_owner_uidx").on(t.developerId).where(sql.raw("role = 'owner' AND status = 'active'")),
  index("developer_memberships_user_status_idx").on(t.canonicalUserId, t.status),
  check("developer_memberships_role_check", sql.raw("role IN ('owner','admin','release_manager','analyst','support_readonly')")),
  check("developer_memberships_status_check", sql.raw("status IN ('invited','active','suspended','revoked')"))
]);

export const developerInvitations = marketplace.table("developer_invitations", {
  id: uuid("id").primaryKey(),
  developerId: uuid("developer_id").notNull().references(() => developers.id, { onDelete: "restrict" }),
  normalizedEmail: varchar("normalized_email", { length: 320 }).notNull(),
  role: varchar("role", { length: 24 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  invitedByCanonicalUserId: uuid("invited_by_canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  acceptedByCanonicalUserId: uuid("accepted_by_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("developer_invitations_token_hash_uidx").on(t.tokenHash),
  uniqueIndex("developer_invitations_one_pending_owner_transfer_uidx").on(t.developerId)
    .where(sql.raw("role = 'owner' AND accepted_at IS NULL AND revoked_at IS NULL")),
  index("developer_invitations_developer_created_idx").on(t.developerId, t.createdAt),
  index("developer_invitations_email_created_idx").on(t.normalizedEmail, t.createdAt),
  check("developer_invitations_email_normalized_check", sql.raw("normalized_email = lower(btrim(normalized_email))")),
  check("developer_invitations_token_hash_check", sql.raw("length(token_hash) = 64 AND token_hash ~ '^[a-f0-9]{64}$'")),
  check("developer_invitations_role_check", sql.raw("role IN ('owner','admin','release_manager','analyst','support_readonly')")),
  check("developer_invitations_expiry_check", sql.raw("expires_at > created_at")),
  check("developer_invitations_acceptance_check", sql.raw("(accepted_at IS NULL AND accepted_by_canonical_user_id IS NULL) OR (accepted_at IS NOT NULL AND accepted_by_canonical_user_id IS NOT NULL)"))
]);

export const categories = marketplace.table("categories", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("categories_slug_uidx").on(t.slug),
  index("categories_parent_status_order_idx").on(t.parentId, t.status, t.sortOrder),
  check("categories_status_check", sql.raw("status IN ('active','hidden','retired')")),
  check("categories_not_self_parent_check", sql.raw("parent_id IS NULL OR parent_id <> id"))
]);

export const categoryLocalizations = marketplace.table("category_localizations", {
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
  locale: varchar("locale", { length: 35 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  primaryKey({ columns: [t.categoryId, t.locale], name: "category_localizations_pk" }),
  check("category_localizations_locale_check", sql.raw("locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'"))
]);

export const apps = marketplace.table("apps", {
  id: uuid("id").primaryKey(),
  developerId: uuid("developer_id").notNull().references(() => developers.id, { onDelete: "restrict" }),
  slug: varchar("slug", { length: 140 }).notNull(),
  appType: varchar("app_type", { length: 16 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  slugLockedAt: timestamp("slug_locked_at", { withTimezone: true }),
  aggregateVersion: bigint("aggregate_version", { mode: "number" }).notNull().default(1),
  createdByCanonicalUserId: uuid("created_by_canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true })
}, (t) => [
  uniqueIndex("apps_slug_uidx").on(t.slug),
  index("apps_developer_status_created_idx").on(t.developerId, t.status, t.createdAt),
  index("apps_status_published_idx").on(t.status, t.publishedAt),
  check("apps_type_check", sql.raw("app_type IN ('app','game')")),
  check("apps_status_check", sql.raw("status IN ('draft','published','suspended','archived')")),
  check("apps_aggregate_version_check", sql.raw("aggregate_version > 0")),
  check("apps_slug_locked_check", sql.raw("slug_locked_at IS NULL OR published_at IS NOT NULL")),
  check("apps_published_state_check", sql.raw("status <> 'published' OR (slug_locked_at IS NOT NULL AND published_at IS NOT NULL)"))
]);

export const appListingRevisions = marketplace.table("app_listing_revisions", {
  id: uuid("id").primaryKey(),
  appId: uuid("app_id").notNull().references(() => apps.id, { onDelete: "restrict" }),
  revisionNumber: integer("revision_number").notNull(),
  contentLocale: varchar("content_locale", { length: 35 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  tagline: varchar("tagline", { length: 240 }),
  description: text("description").notNull(),
  websiteUrl: text("website_url"),
  privacyPolicyUrl: text("privacy_policy_url"),
  supportUrl: text("support_url"),
  contentRating: varchar("content_rating", { length: 32 }),
  privacyDisclosure: jsonb("privacy_disclosure").$type<Record<string, unknown>>().notNull().default({}),
  metadataChecksum: varchar("metadata_checksum", { length: 64 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  submittedByCanonicalUserId: uuid("submitted_by_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  reviewedByCanonicalUserId: uuid("reviewed_by_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  decisionCode: varchar("decision_code", { length: 40 }),
  decisionNote: text("decision_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("app_listing_revisions_app_locale_revision_uidx").on(t.appId, t.contentLocale, t.revisionNumber),
  uniqueIndex("app_listing_revisions_one_published_locale_uidx").on(t.appId, t.contentLocale).where(sql.raw("status = 'published'")),
  index("app_listing_revisions_app_locale_status_idx").on(t.appId, t.contentLocale, t.status),
  check("app_listing_revisions_number_check", sql.raw("revision_number > 0")),
  check("app_listing_revisions_status_check", sql.raw("status IN ('draft','submitted','in_review','approved','published','rejected','superseded')")),
  check("app_listing_revisions_checksum_check", sql.raw("metadata_checksum ~ '^[a-f0-9]{64}$'")),
  check("app_listing_revisions_locale_check", sql.raw("content_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'"))
]);

export const appListingRevisionCategories = marketplace.table("app_listing_revision_categories", {
  revisionId: uuid("revision_id").notNull().references(() => appListingRevisions.id, { onDelete: "restrict" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" })
}, (t) => [
  primaryKey({ columns: [t.revisionId, t.categoryId], name: "app_listing_revision_categories_pk" }),
  index("app_listing_revision_categories_category_idx").on(t.categoryId)
]);

export const appListingRevisionMedia = marketplace.table("app_listing_revision_media", {
  id: uuid("id").primaryKey(),
  revisionId: uuid("revision_id").notNull().references(() => appListingRevisions.id, { onDelete: "restrict" }),
  mediaType: varchar("media_type", { length: 24 }).notNull(),
  objectVersionId: uuid("object_version_id").notNull(),
  altText: varchar("alt_text", { length: 240 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("app_listing_revision_media_order_idx").on(t.revisionId, t.sortOrder),
  check("app_listing_revision_media_type_check", sql.raw("media_type IN ('icon','screenshot','video','banner')")),
  check("app_listing_revision_media_order_check", sql.raw("sort_order >= 0"))
]);

export const appListingPlatformTargets = marketplace.table("app_listing_platform_targets", {
  id: uuid("id").primaryKey(),
  revisionId: uuid("revision_id").notNull().references(() => appListingRevisions.id, { onDelete: "restrict" }),
  platform: varchar("platform", { length: 24 }).notNull(),
  architecture: varchar("architecture", { length: 64 }).notNull().default("universal"),
  minimumOsVersion: varchar("minimum_os_version", { length: 64 }),
  maximumOsVersion: varchar("maximum_os_version", { length: 64 }),
  availabilityStatus: varchar("availability_status", { length: 24 }).notNull().default("available"),
  regionAllowlist: jsonb("region_allowlist").$type<string[] | null>()
}, (t) => [
  uniqueIndex("app_listing_platform_targets_revision_platform_arch_uidx").on(t.revisionId, t.platform, t.architecture),
  check("app_listing_platform_targets_platform_check", sql.raw("platform IN ('android','ios','web','windows','macos','linux')")),
  check("app_listing_platform_targets_availability_check", sql.raw("availability_status IN ('available','planned','unavailable','region_limited')"))
]);

export const appVersions = marketplace.table("app_versions", {
  id: uuid("id").primaryKey(),
  appId: uuid("app_id").notNull().references(() => apps.id, { onDelete: "restrict" }),
  platform: varchar("platform", { length: 24 }).notNull(),
  versionName: varchar("version_name", { length: 80 }).notNull(),
  versionCode: varchar("version_code", { length: 80 }),
  releaseNotes: text("release_notes"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdByCanonicalUserId: uuid("created_by_canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("app_versions_app_platform_name_uidx").on(t.appId, t.platform, t.versionName),
  uniqueIndex("app_versions_app_platform_code_uidx").on(t.appId, t.platform, t.versionCode).where(sql.raw("version_code IS NOT NULL")),
  index("app_versions_app_platform_status_idx").on(t.appId, t.platform, t.status),
  check("app_versions_platform_check", sql.raw("platform IN ('android','ios','web','windows','macos','linux')")),
  check("app_versions_status_check", sql.raw("status IN ('draft','submitted','scanning','approved','rejected','withdrawn')"))
]);

export const appArtifacts = marketplace.table("app_artifacts", {
  id: uuid("id").primaryKey(),
  appVersionId: uuid("app_version_id").notNull().references(() => appVersions.id, { onDelete: "restrict" }),
  artifactFormat: varchar("artifact_format", { length: 16 }).notNull(),
  storageObjectVersionId: uuid("storage_object_version_id").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  detectedMime: varchar("detected_mime", { length: 120 }).notNull(),
  packageIdentifier: varchar("package_identifier", { length: 255 }),
  signerFingerprint: varchar("signer_fingerprint", { length: 255 }),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
  scanStatus: varchar("scan_status", { length: 16 }).notNull().default("pending"),
  approvalStatus: varchar("approval_status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("app_artifacts_object_version_uidx").on(t.storageObjectVersionId),
  uniqueIndex("app_artifacts_sha_version_uidx").on(t.appVersionId, t.sha256),
  index("app_artifacts_scan_approval_idx").on(t.scanStatus, t.approvalStatus),
  check("app_artifacts_format_check", sql.raw("artifact_format = 'apk'")),
  check("app_artifacts_sha_check", sql.raw("sha256 ~ '^[a-f0-9]{64}$'")),
  check("app_artifacts_size_check", sql.raw("size_bytes > 0")),
  check("app_artifacts_mime_check", sql.raw("detected_mime = 'application/vnd.android.package-archive'")),
  check("app_artifacts_scan_status_check", sql.raw("scan_status IN ('pending','clean','suspicious','malicious','error')")),
  check("app_artifacts_approval_status_check", sql.raw("approval_status IN ('pending','approved','rejected','revoked')"))
]);

export const distributionSources = marketplace.table("distribution_sources", {
  id: uuid("id").primaryKey(),
  appVersionId: uuid("app_version_id").notNull().references(() => appVersions.id, { onDelete: "restrict" }),
  sourceType: varchar("source_type", { length: 32 }).notNull(),
  sourceUrl: text("source_url"),
  artifactId: uuid("artifact_id").references(() => appArtifacts.id, { onDelete: "restrict" }),
  verificationStatus: varchar("verification_status", { length: 24 }).notNull().default("pending"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  regionPolicy: jsonb("region_policy").$type<Record<string, unknown>>().notNull().default({}),
  approvedByCanonicalUserId: uuid("approved_by_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("distribution_sources_version_status_idx").on(t.appVersionId, t.status, t.verificationStatus),
  check("distribution_sources_type_check", sql.raw("source_type IN ('official_store_link','verified_publisher_link','globe_hosted_verified')")),
  check("distribution_sources_verification_check", sql.raw("verification_status IN ('pending','verified','rejected','revoked')")),
  check("distribution_sources_status_check", sql.raw("status IN ('pending','active','withdrawn')")),
  check("distribution_sources_url_check", sql.raw("(source_type = 'globe_hosted_verified' AND source_url IS NULL AND artifact_id IS NOT NULL) OR (source_type <> 'globe_hosted_verified' AND source_url IS NOT NULL AND source_url ~ '^https://')")),
  check("distribution_sources_approval_check", sql.raw("status <> 'active' OR (verification_status = 'verified' AND approved_at IS NOT NULL AND approved_by_canonical_user_id IS NOT NULL)"))
]);

export const reviews = marketplace.table("reviews", {
  id: uuid("id").primaryKey(),
  appId: uuid("app_id").notNull().references(() => apps.id, { onDelete: "restrict" }),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  publisherAffiliation: varchar("publisher_affiliation", { length: 24 }).notNull().default("none"),
  publishedRevisionId: uuid("published_revision_id").references((): AnyPgColumn => reviewRevisions.id, { onDelete: "restrict" }),
  pendingRevisionId: uuid("pending_revision_id").references((): AnyPgColumn => reviewRevisions.id, { onDelete: "restrict" }),
  repostAllowedAt: timestamp("repost_allowed_at", { withTimezone: true }),
  aggregateVersion: bigint("aggregate_version", { mode: "number" }).notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true })
}, (t) => [
  uniqueIndex("reviews_one_unless_repost_allowed_uidx").on(t.appId, t.canonicalUserId).where(sql.raw("repost_allowed_at IS NULL")),
  index("reviews_app_status_created_idx").on(t.appId, t.status, t.createdAt),
  index("reviews_user_created_idx").on(t.canonicalUserId, t.createdAt),
  check("reviews_status_check", sql.raw("status IN ('pending','published','rejected','hidden','removed')")),
  check("reviews_affiliation_check", sql.raw("publisher_affiliation IN ('none','employee','contractor','other')")),
  check("reviews_aggregate_version_check", sql.raw("aggregate_version > 0")),
  check("reviews_published_pointer_check", sql.raw("status <> 'published' OR published_revision_id IS NOT NULL"))
]);

export const reviewRevisions = marketplace.table("review_revisions", {
  id: uuid("id").primaryKey(),
  reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "restrict" }),
  revisionNumber: integer("revision_number").notNull(),
  rating: smallint("rating"),
  title: varchar("title", { length: 160 }),
  body: text("body").notNull(),
  experienceContext: jsonb("experience_context").$type<Record<string, unknown>>().notNull().default({}),
  changeReason: text("change_reason"),
  createdByCanonicalUserId: uuid("created_by_canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  moderationStatus: varchar("moderation_status", { length: 16 }).notNull().default("pending"),
  reviewedByCanonicalUserId: uuid("reviewed_by_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  decisionCode: varchar("decision_code", { length: 40 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("review_revisions_review_number_uidx").on(t.reviewId, t.revisionNumber),
  index("review_revisions_review_status_idx").on(t.reviewId, t.moderationStatus),
  check("review_revisions_number_check", sql.raw("revision_number > 0")),
  check("review_revisions_rating_check", sql.raw("rating IS NULL OR rating BETWEEN 1 AND 5")),
  check("review_revisions_moderation_status_check", sql.raw("moderation_status IN ('pending','approved','rejected')"))
]);

export const reviewVotes = marketplace.table("review_votes", {
  reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "restrict" }),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  vote: varchar("vote", { length: 16 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  primaryKey({ columns: [t.reviewId, t.canonicalUserId], name: "review_votes_pk" }),
  check("review_votes_vote_check", sql.raw("vote IN ('helpful','not_helpful')"))
]);

export const appRatingAggregates = marketplace.table("app_rating_aggregates", {
  appId: uuid("app_id").primaryKey().references(() => apps.id, { onDelete: "restrict" }),
  ratingCount: bigint("rating_count", { mode: "number" }).notNull().default(0),
  ratingSum: bigint("rating_sum", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  check("app_rating_aggregates_count_check", sql.raw("rating_count >= 0")),
  check("app_rating_aggregates_sum_check", sql.raw("rating_sum >= rating_count AND rating_sum <= rating_count * 5"))
]);

export const moderationCases = marketplace.table("moderation_cases", {
  id: uuid("id").primaryKey(),
  targetType: varchar("target_type", { length: 32 }).notNull(),
  targetId: uuid("target_id").notNull(),
  reporterCanonicalUserId: uuid("reporter_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  assignedToCanonicalUserId: uuid("assigned_to_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  reasonCode: varchar("reason_code", { length: 40 }).notNull(),
  details: text("details"),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  resolutionCode: varchar("resolution_code", { length: 40 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
}, (t) => [
  index("moderation_cases_status_created_idx").on(t.status, t.createdAt),
  index("moderation_cases_assignee_status_idx").on(t.assignedToCanonicalUserId, t.status),
  index("moderation_cases_target_idx").on(t.targetType, t.targetId),
  check("moderation_cases_target_type_check", sql.raw("target_type IN ('app_listing_revision','review','artifact','distribution_source','developer')")),
  check("moderation_cases_status_check", sql.raw("status IN ('open','investigating','actioned','dismissed','appealed','closed')"))
]);

export const auditEvents = marketplace.table("audit_events", {
  id: uuid("id").primaryKey(),
  actorCanonicalUserId: uuid("actor_canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  actorType: varchar("actor_type", { length: 24 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  targetType: varchar("target_type", { length: 40 }).notNull(),
  targetId: uuid("target_id").notNull(),
  reasonCode: varchar("reason_code", { length: 40 }),
  correlationId: varchar("correlation_id", { length: 100 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("audit_events_target_created_idx").on(t.targetType, t.targetId, t.createdAt),
  index("audit_events_actor_created_idx").on(t.actorCanonicalUserId, t.createdAt),
  check("audit_events_actor_type_check", sql.raw("actor_type IN ('user','platform_operator','system')"))
]);

export const domainOutbox = marketplace.table("domain_outbox", {
  eventId: uuid("event_id").primaryKey(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  schemaVersion: integer("schema_version").notNull(),
  aggregateType: varchar("aggregate_type", { length: 40 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  aggregateVersion: bigint("aggregate_version", { mode: "number" }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  invalidationTags: text("invalidation_tags").array().notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  leaseOwner: varchar("lease_owner", { length: 120 }),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastErrorCode: varchar("last_error_code", { length: 80 }),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("domain_outbox_pending_idx").on(t.availableAt, t.createdAt).where(sql.raw("dispatched_at IS NULL")),
  index("domain_outbox_aggregate_history_idx").on(t.aggregateType, t.aggregateId, t.aggregateVersion),
  check("domain_outbox_event_type_check", sql.raw("event_type IN ('app.projection.upsert.v1','app.projection.delete.v1','review.projection.upsert.v1','review.projection.delete.v1')")),
  check("domain_outbox_versions_check", sql.raw("schema_version = 1 AND aggregate_version > 0")),
  check("domain_outbox_attempt_count_check", sql.raw("attempt_count >= 0")),
  check("domain_outbox_tags_count_check", sql.raw("cardinality(invalidation_tags) BETWEEN 1 AND 50")),
  check("domain_outbox_tags_format_check", sql.raw("marketplace.is_valid_invalidation_tags(invalidation_tags)")),
  check("domain_outbox_lease_check", sql.raw("(lease_owner IS NULL AND lease_expires_at IS NULL) OR (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)"))
]);

export const projectionEventReceipts = marketplace.table("projection_event_receipts", {
  eventId: uuid("event_id").primaryKey().references(() => domainOutbox.eventId, { onDelete: "restrict" }),
  aggregateType: varchar("aggregate_type", { length: 40 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  aggregateVersion: bigint("aggregate_version", { mode: "number" }).notNull(),
  outcome: varchar("outcome", { length: 16 }).notNull(),
  invalidationState: varchar("invalidation_state", { length: 16 }).notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  invalidationCompletedAt: timestamp("invalidation_completed_at", { withTimezone: true })
}, (t) => [
  index("projection_event_receipts_aggregate_idx").on(t.aggregateType, t.aggregateId, t.aggregateVersion),
  check("projection_event_receipts_outcome_check", sql.raw("outcome IN ('applied','stale','deleted','ignored')")),
  check("projection_event_receipts_invalidation_check", sql.raw("(invalidation_state = 'completed' AND invalidation_completed_at IS NOT NULL) OR (invalidation_state IN ('pending','not_required') AND invalidation_completed_at IS NULL)"))
]);

export const projectionAggregateWatermarks = marketplace.table("projection_aggregate_watermarks", {
  aggregateType: varchar("aggregate_type", { length: 40 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  latestVersion: bigint("latest_version", { mode: "number" }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  primaryKey({ columns: [t.aggregateType, t.aggregateId], name: "projection_aggregate_watermarks_pk" }),
  check("projection_aggregate_watermarks_version_check", sql.raw("latest_version > 0"))
]);

export const marketplaceSchema = {
  developers,
  developerMemberships,
  developerInvitations,
  categories,
  categoryLocalizations,
  apps,
  appListingRevisions,
  appListingRevisionCategories,
  appListingRevisionMedia,
  appListingPlatformTargets,
  appVersions,
  appArtifacts,
  distributionSources,
  reviews,
  reviewRevisions,
  reviewVotes,
  appRatingAggregates,
  moderationCases,
  auditEvents,
  domainOutbox,
  projectionEventReceipts,
  projectionAggregateWatermarks
};
