import { z } from "zod";
import { publicAppDetailSchema, publicReviewSchema } from "./contracts.js";

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const slugSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,138}[a-z0-9])?$/);

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
    projection: publicAppDetailSchema
  }).strict(),
  z.object({
    ...base,
    eventType: z.literal("app.projection.delete.v1"),
    aggregate: z.object({ type: z.literal("app"), id: z.string().uuid(), slug: slugSchema }).strict(),
    locale: localeSchema
  }).strict(),
  z.object({
    ...base,
    eventType: z.literal("review.projection.upsert.v1"),
    aggregate: z.object({ type: z.literal("review"), id: z.string().uuid(), appSlug: slugSchema }).strict(),
    locale: localeSchema,
    projection: publicReviewSchema
  }).strict(),
  z.object({
    ...base,
    eventType: z.literal("review.projection.delete.v1"),
    aggregate: z.object({ type: z.literal("review"), id: z.string().uuid(), appSlug: slugSchema }).strict(),
    locale: localeSchema
  }).strict()
]).superRefine((event, context) => {
  if (event.eventType === "app.projection.upsert.v1" &&
      (event.projection.id !== event.aggregate.id || event.projection.slug !== event.aggregate.slug ||
       event.projection.contentLocale !== event.locale)) {
    context.addIssue({ code: "custom", message: "App projection identity, slug and locale must match the outbox envelope." });
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
