import { z } from "zod";

const ratingSchema = z.object({
  average: z.number().min(0).max(5),
  count: z.number().int().nonnegative()
}).strict();

const publisherSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(120),
  verificationStatus: z.enum(["verified", "unverified"]),
  websiteUrl: z.string().url().nullable()
}).strict();

const mediaSchema = z.object({
  type: z.enum(["icon", "screenshot", "video", "banner"]),
  url: z.string().url(),
  alt: z.string().max(240),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable()
}).strict();

const distributionSchema = z.object({
  type: z.enum(["official_store_link", "developer_download"]),
  label: z.string().min(1).max(80),
  url: z.string().url()
}).strict();

export const publicAppDetailSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(140),
  name: z.string().min(1).max(160),
  tagline: z.string().max(240).nullable(),
  description: z.string(),
  appType: z.enum(["app", "game"]),
  contentLocale: z.string().min(2).max(16),
  publisher: publisherSchema,
  categories: z.array(z.object({
    slug: z.string().min(1).max(80),
    name: z.string().min(1).max(100)
  }).strict()),
  media: z.array(mediaSchema),
  platforms: z.array(z.object({
    platform: z.string().min(1).max(24),
    minimumOsVersion: z.string().max(64).nullable(),
    availabilityStatus: z.enum(["available", "unavailable", "limited"])
  }).strict()),
  latestVersions: z.array(z.object({
    platform: z.string().min(1).max(24),
    versionName: z.string().min(1).max(80),
    releasedAt: z.string().datetime().nullable(),
    releaseNotes: z.string().nullable(),
    distribution: z.array(distributionSchema)
  }).strict()),
  privacyPolicyUrl: z.string().url().nullable(),
  supportUrl: z.string().url().nullable(),
  websiteUrl: z.string().url().nullable(),
  rating: ratingSchema.optional(),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const publicReviewSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(160).nullable(),
  body: z.string().min(1),
  rating: z.number().int().min(1).max(5).nullable(),
  author: z.object({
    displayName: z.string().min(1).max(80),
    publisherAffiliation: z.enum(["none", "developer", "employee", "other"])
  }).strict(),
  appVersion: z.string().max(80).nullable(),
  createdAt: z.string().datetime(),
  helpfulCount: z.number().int().nonnegative()
}).strict();

export type PublicAppDetail = z.infer<typeof publicAppDetailSchema>;
export type PublicReview = z.infer<typeof publicReviewSchema>;
