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
  /** Must be idempotent, rate-limited and accept at most 100 tags per request. */
  purge(tags: string[]): Promise<void>;
}

export type ProjectionProcessOutcome = "applied" | "duplicate" | "stale";
const MAX_TAGS_PER_PURGE_REQUEST = 100;
const MAX_QUEUE_BATCH_MESSAGES = 100;

export async function processProjectionQueueBatch(
  messages: unknown[],
  store: ProjectionEventStore,
  invalidator: CacheTagInvalidator
): Promise<ProjectionProcessOutcome[]> {
  if (messages.length < 1 || messages.length > MAX_QUEUE_BATCH_MESSAGES) {
    throw new Error("Projection Queue batch size is outside the supported bounds.");
  }

  const pendingInvalidations: Array<{ eventId: string; tags: string[] }> = [];
  const outcomes: ProjectionProcessOutcome[] = [];

  // Keep application order deterministic. Aggregate-version checks in the
  // transactional store remain authoritative when Queue delivery is reordered.
  for (const message of messages) {
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
    outcomes.push(applied.status);
    if (applied.status !== "stale" && applied.cacheInvalidationPending) {
      pendingInvalidations.push({ eventId: event.eventId, tags: event.invalidationTags });
    }
  }

  // Coalesce repeated tags across the Queue batch and obey Cloudflare's
  // maximum of 100 purge operations per API request.
  const uniqueTags = [...new Set(pendingInvalidations.flatMap((item) => item.tags))];
  for (let offset = 0; offset < uniqueTags.length; offset += MAX_TAGS_PER_PURGE_REQUEST) {
    await invalidator.purge(uniqueTags.slice(offset, offset + MAX_TAGS_PER_PURGE_REQUEST));
  }

  // Mark receipts only after every purge chunk succeeds. If a purge or mark
  // fails, Queue redelivery is safe: projection receipts dedupe writes and
  // pending invalidations are retried idempotently.
  for (const item of pendingInvalidations) {
    await store.markCacheInvalidationComplete(item.eventId);
  }

  return outcomes;
}

export async function processProjectionQueueMessage(
  message: unknown,
  store: ProjectionEventStore,
  invalidator: CacheTagInvalidator
): Promise<ProjectionProcessOutcome> {
  const outcomes = await processProjectionQueueBatch([message], store, invalidator);
  return outcomes[0]!;
}
