import { z } from "zod";
import { publicAppDetailSchema, publicReviewSchema } from "./contracts.js";

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const slugSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,138}[a-z0-9])?$/);
const invalidationTagSchema = z.string().min(3).max(200).regex(/^[a-z][A-Za-z0-9-]*(?::[a-zA-Z0-9-]+){0,2}$/);
const invalidationTagsSchema = z.array(invalidationTagSchema).min(1).max(50).refine((tags) => new Set(tags).size === tags.length, "Invalidation tags must be unique.");

const base = {
  eventId: z.string().uuid(),
  schemaVersion: z.literal(1),
  aggregateVersion: z.number().int().positive(),
  occurredAt: z.string().datetime()
};

export const projectionOutboxEventSchema = z.discriminatedUnion("eventType", [
  z.object({
    ...base,
    eventType: z.literal("app.projection.upsert.v1"),
    aggregate: z.object({ type: z.literal("app"), id: z.string().uuid(), slug: slugSchema }).strict(),
    locale: localeSchema,
    invalidationTags: invalidationTagsSchema,
    projection: publicAppDetailSchema
  }).strict(),
  z.object({
    ...base,
    eventType: z.literal("app.projection.delete.v1"),
    aggregate: z.object({ type: z.literal("app"), id: z.string().uuid(), slug: slugSchema }).strict(),
    locale: localeSchema,
    invalidationTags: invalidationTagsSchema
  }).strict(),
  z.object({
    ...base,
    eventType: z.literal("review.projection.upsert.v1"),
    aggregate: z.object({ type: z.literal("review"), id: z.string().uuid(), appSlug: slugSchema }).strict(),
    locale: localeSchema,
    invalidationTags: invalidationTagsSchema,
    projection: publicReviewSchema
  }).strict(),
  z.object({
    ...base,
    eventType: z.literal("review.projection.delete.v1"),
    aggregate: z.object({ type: z.literal("review"), id: z.string().uuid(), appSlug: slugSchema }).strict(),
    locale: localeSchema,
    invalidationTags: invalidationTagsSchema
  }).strict()
]).superRefine((event, context) => {
  const appSlug = event.eventType === "app.projection.upsert.v1" || event.eventType === "app.projection.delete.v1" ? event.aggregate.slug : event.aggregate.appSlug;
  const requiredTags = ["app:" + appSlug, "app:" + appSlug + ":reviews", "app:" + appSlug + ":rating", "locale:" + event.locale];
  for (const tag of requiredTags) {
    if (!event.invalidationTags.includes(tag)) context.addIssue({ code: "custom", message: "Required cache invalidation tag is missing: " + tag });
  }
  if (event.eventType === "app.projection.upsert.v1") {
    if (event.projection.id !== event.aggregate.id || event.projection.slug !== event.aggregate.slug || event.projection.contentLocale !== event.locale) {
      context.addIssue({ code: "custom", message: "App projection identity, slug and locale must match the outbox envelope." });
    }
    const currentTags = ["developer:" + event.projection.publisher.slug, ...event.projection.categories.map((category) => "category:" + category.slug)];
    for (const tag of currentTags) {
      if (!event.invalidationTags.includes(tag)) context.addIssue({ code: "custom", message: "Current app relationships must be included in invalidation tags: " + tag });
    }
  }
  if (event.eventType === "review.projection.upsert.v1" && event.projection.id !== event.aggregate.id) {
    context.addIssue({ code: "custom", message: "Review projection identity must match the outbox envelope." });
  }
});

export type ProjectionOutboxEvent = z.infer<typeof projectionOutboxEventSchema>;

export const projectionQueueMessageSchema = z.object({
  eventId: z.string().uuid(),
  schemaVersion: z.literal(1)
}).strict();

export type ProjectionQueueMessage = z.infer<typeof projectionQueueMessageSchema>;
