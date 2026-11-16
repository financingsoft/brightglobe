import { projectionOutboxEventSchema, projectionQueueMessageSchema, type ProjectionOutboxEvent } from "./projection-events.js";

export type ProjectionApplyResult =
  | { status: "applied" | "duplicate"; cacheInvalidationPending: boolean }
  | { status: "stale"; cacheInvalidationPending: false };

export interface ProjectionEventStore {
  /** Read the immutable sanitized outbox payload by its stable event ID. */
  getOutboxEvent(eventId: string): Promise<unknown | null>;
  /**
   * In one database transaction: enforce the aggregate version watermark,
   * write/delete the projection, and insert the unique event receipt.
   * A receipt remains invalidation-pending until markCacheInvalidationComplete succeeds.
   */
  applyAtomically(event: ProjectionOutboxEvent): Promise<ProjectionApplyResult>;
  markCacheInvalidationComplete(eventId: string): Promise<void>;
}

export interface CacheTagInvalidator {
  /** Must be idempotent. Tags are validated by the event schema before this call. */
  purge(tags: string[]): Promise<void>;
}

export type ProjectionProcessOutcome = "applied" | "duplicate" | "stale";

export async function processProjectionQueueMessage(
  message: unknown,
  store: ProjectionEventStore,
  invalidator: CacheTagInvalidator
): Promise<ProjectionProcessOutcome> {
  const parsedMessage = projectionQueueMessageSchema.safeParse(message);
  if (!parsedMessage.success) throw new Error("Invalid projection Queue message.");

  const rawEvent = await store.getOutboxEvent(parsedMessage.data.eventId);
  if (rawEvent === null) throw new Error("Projection outbox event not found; retry delivery.");

  const parsedEvent = projectionOutboxEventSchema.safeParse(rawEvent);
  if (!parsedEvent.success) throw new Error("Stored projection outbox event failed schema validation.");

  const event = parsedEvent.data;
  if (event.eventId !== parsedMessage.data.eventId || event.schemaVersion !== parsedMessage.data.schemaVersion) {
    throw new Error("Queue message and outbox event identity/version mismatch.");
  }

  const applied = await store.applyAtomically(event);
  if (applied.status === "stale") return "stale";

  // A duplicate can still have a pending purge if a previous attempt committed
  // the projection but failed before completing cache invalidation.
  if (applied.cacheInvalidationPending) {
    await invalidator.purge(event.invalidationTags);
    await store.markCacheInvalidationComplete(event.eventId);
  }

  return applied.status;
}
