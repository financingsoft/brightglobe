# Globe Play — Projection Outbox & Queue Contract

**Status:** Proposed implementation contract · Requires review before migrations or runtime activation  
**Depends on:** PLAY_MARKETPLACE_MASTER_CONTRACT.md, PLAY_MARKETPLACE_DATA_CONTRACT.md, PLAY_DATA_MODEL_V2_CONTRACT.md and PLAY_PUBLIC_READ_API_CONTRACT.md

## 1. Purpose and security boundary

The public read Worker remains read-only. It receives only SELECT privileges on the public projection tables. Projection writes, event receipt writes and cache invalidation credentials belong to a separate projector/relay execution identity. Do not add write privileges or Cloudflare purge credentials to the public read Worker.

## 2. Event model

A business transaction writes its domain mutation and a `marketplace.domain_outbox` row in the same PostgreSQL transaction. The outbox payload is a strictly validated, already-sanitized public projection snapshot (or a deletion instruction). It must never contain canonical user IDs, email addresses, moderation evidence, private R2 keys, secrets, internal notes, unapproved distribution URLs or unpublished fields.

Supported version-1 event types:
- `app.projection.upsert.v1`
- `app.projection.delete.v1`
- `review.projection.upsert.v1`
- `review.projection.delete.v1`

Every event has immutable `event_id`, `schema_version`, `aggregate_type/id`, monotonic `aggregate_version`, `occurred_at`, locale and a strict public projection payload where applicable. The event ID is the idempotency key. Aggregate version prevents older events overwriting newer projections.

The Cloudflare Queue message contains only `eventId` and `schemaVersion`; it does not duplicate the projection snapshot. The consumer loads the durable outbox event by ID. This keeps Queue messages small and allows safe retries.

## 3. Delivery and idempotency

- An outbox relay claims pending rows with a bounded lease and `FOR UPDATE SKIP LOCKED`, sends Queue messages, and marks rows dispatched only after Queue send succeeds.
- A crash after Queue send but before marking dispatched can cause duplicate delivery. This is expected; consumers must be idempotent.
- The consumer inserts an event receipt and updates the relevant projection in one database transaction. A unique receipt on `event_id` prevents duplicate application.
- Projection writes are conditional on aggregate version. A stale event is acknowledged without overwriting newer state.
- Failed messages retry with bounded exponential delay; exhausted messages go to a dedicated DLQ and alert. Replaying a DLQ message is safe.
- Queue delivery is at-least-once, not exactly-once.

## 4. Projection and invalidation ordering

1. Validate the event envelope and strict public payload.
2. Apply the projection update/delete and event receipt atomically.
3. Only after the database transaction commits, invalidate targeted cache tags.
4. A cache purge failure is recorded and retried independently; do not roll back a committed projection.
5. Takedown events revoke download authorization through the authoritative download API immediately; cache invalidation is not an authorization mechanism.

Initial cache tags:
- `app:{slug}`
- `app:{slug}:reviews`
- `developer:{slug}`
- `category:{slug}`
- `locale:{locale}`

Public API responses attach the applicable tags using Cloudflare's `Cache-Tag` response header. The read Worker only emits tags; it does not hold a purge token or perform purge operations. Purge by tag is an external Cloudflare API operation and requires a dedicated least-privilege Cache Purge credential held only by the projector. Do not purge an entire zone for a single app or review change.

## 5. Database entities (logical, not authorized DDL)

- `marketplace.domain_outbox`: event ID, aggregate identity/version, event type/schema version, sanitized payload, occurrence time, dispatch lease, attempts, next-attempt time and dispatched timestamp.
- `marketplace.projection_event_receipts`: event ID primary key, aggregate identity/version, applied outcome and processed timestamp.
- Public app detail projection carries `projection_version`; review projection carries its own version. Deletion uses version tombstones or a monotonic aggregate watermark so delayed old upserts cannot resurrect removed content.

Exact DDL, constraints, lock strategy, indexes, and source transaction integration must be reviewed against the actual Staging schema before migration. This proposal does not authorize any migration.

## 6. Open decisions / explicit blockers

- Final source-of-truth schema and transaction boundaries for app listing revisions and review moderation are not yet implemented.
- The publisher must prove that every public projection snapshot is generated from an approved immutable listing revision and currently approved distribution sources.
- Review aggregation policy (rating eligibility, edited/removed review handling and locale scope) must be finalized before the projector recalculates rating summaries.
- Cloudflare zone ID, purge token scope, cache-tag response behavior and retry/DLQ alert destination must be configured and tested in Staging.
- Cache purge limits and cost must be measured; invalidation must be batched and coalesced during bulk edits.

No database migration, Queue creation, Worker deployment, cache purge credential creation, DNS change or Production action is authorized by this proposal.
