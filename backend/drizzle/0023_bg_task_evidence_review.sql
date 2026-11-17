CREATE TABLE "bg_task_evidence_records" (
  "id" uuid PRIMARY KEY,
  "canonical_user_id" uuid NOT NULL REFERENCES "canonical_users"("id") ON DELETE RESTRICT,
  "task_id" varchar(64) NOT NULL,
  "task_version" integer NOT NULL,
  "verifier_key" varchar(64) NOT NULL,
  "source" varchar(64) NOT NULL,
  "issuer" varchar(32) NOT NULL,
  "source_evidence_id" varchar(128) NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "digest_sha256" varchar(64) NOT NULL,
  "idempotency_key" varchar(160) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending_review',
  "consumed_reward_event_id" uuid REFERENCES "reward_events"("id") ON DELETE RESTRICT,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bg_task_evidence_task_version_check" CHECK ("task_version" > 0),
  CONSTRAINT "bg_task_evidence_issuer_check" CHECK ("issuer" IN ('brightglobe-server', 'trusted-provider')),
  CONSTRAINT "bg_task_evidence_digest_check" CHECK ("digest_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "bg_task_evidence_status_check" CHECK ("status" IN ('pending_review', 'approved', 'rejected', 'appealed', 'consumed')),
  CONSTRAINT "bg_task_evidence_consumed_check" CHECK (("status" = 'consumed' AND "consumed_reward_event_id" IS NOT NULL) OR ("status" <> 'consumed' AND "consumed_reward_event_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bg_task_evidence_idempotency_uidx" ON "bg_task_evidence_records" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "bg_task_evidence_source_replay_uidx" ON "bg_task_evidence_records" ("issuer", "source", "source_evidence_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "bg_task_evidence_consumed_reward_uidx" ON "bg_task_evidence_records" ("consumed_reward_event_id") WHERE "consumed_reward_event_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "bg_task_evidence_user_task_status_idx" ON "bg_task_evidence_records" ("canonical_user_id", "task_id", "status", "submitted_at");
--> statement-breakpoint
CREATE TABLE "bg_task_appeals" (
  "id" uuid PRIMARY KEY,
  "evidence_id" uuid NOT NULL UNIQUE REFERENCES "bg_task_evidence_records"("id") ON DELETE RESTRICT,
  "appellant_user_id" uuid NOT NULL REFERENCES "canonical_users"("id") ON DELETE RESTRICT,
  "reason" varchar(2000) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'open',
  "resolved_by" uuid REFERENCES "canonical_users"("id") ON DELETE RESTRICT,
  "resolution_reason" varchar(1000),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  CONSTRAINT "bg_task_appeals_reason_check" CHECK (length(trim("reason")) > 0),
  CONSTRAINT "bg_task_appeals_status_check" CHECK ("status" IN ('open', 'resolved')),
  CONSTRAINT "bg_task_appeals_resolution_check" CHECK (("status" = 'open' AND "resolved_by" IS NULL AND "resolved_at" IS NULL) OR ("status" = 'resolved' AND "resolved_by" IS NOT NULL AND "resolved_at" IS NOT NULL AND "resolution_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX "bg_task_appeals_status_created_idx" ON "bg_task_appeals" ("status", "created_at");
--> statement-breakpoint
CREATE TABLE "bg_task_review_decisions" (
  "id" uuid PRIMARY KEY,
  "evidence_id" uuid NOT NULL REFERENCES "bg_task_evidence_records"("id") ON DELETE RESTRICT,
  "decision_type" varchar(16) NOT NULL,
  "decision" varchar(16) NOT NULL,
  "reviewer_id" uuid NOT NULL REFERENCES "canonical_users"("id") ON DELETE RESTRICT,
  "reason" varchar(1000) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bg_task_review_decision_type_check" CHECK ("decision_type" IN ('initial', 'appeal')),
  CONSTRAINT "bg_task_review_decision_check" CHECK ("decision" IN ('approved', 'rejected')),
  CONSTRAINT "bg_task_review_reason_check" CHECK (length(trim("reason")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bg_task_review_decisions_once_uidx" ON "bg_task_review_decisions" ("evidence_id", "decision_type");
--> statement-breakpoint
CREATE INDEX "bg_task_review_decisions_reviewer_created_idx" ON "bg_task_review_decisions" ("reviewer_id", "created_at");
--> statement-breakpoint
CREATE TABLE "bg_task_audit_events" (
  "id" uuid PRIMARY KEY,
  "evidence_id" uuid NOT NULL REFERENCES "bg_task_evidence_records"("id") ON DELETE RESTRICT,
  "actor_type" varchar(16) NOT NULL,
  "actor_id" varchar(128),
  "action" varchar(64) NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bg_task_audit_actor_check" CHECK ("actor_type" IN ('service', 'user', 'operator'))
);
--> statement-breakpoint
CREATE INDEX "bg_task_audit_evidence_created_idx" ON "bg_task_audit_events" ("evidence_id", "created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_evidence_update() RETURNS trigger AS $bg$
DECLARE
  reward_user uuid;
  reward_action varchar(32);
  reward_evidence varchar(256);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'BG task evidence is immutable and cannot be deleted';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."canonical_user_id" IS DISTINCT FROM OLD."canonical_user_id"
    OR NEW."task_id" IS DISTINCT FROM OLD."task_id"
    OR NEW."task_version" IS DISTINCT FROM OLD."task_version"
    OR NEW."verifier_key" IS DISTINCT FROM OLD."verifier_key"
    OR NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."issuer" IS DISTINCT FROM OLD."issuer"
    OR NEW."source_evidence_id" IS DISTINCT FROM OLD."source_evidence_id"
    OR NEW."occurred_at" IS DISTINCT FROM OLD."occurred_at"
    OR NEW."digest_sha256" IS DISTINCT FROM OLD."digest_sha256"
    OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  THEN
    RAISE EXCEPTION 'BG task evidence identity and source proof are immutable';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NOT (
      (OLD."status" = 'pending_review' AND NEW."status" IN ('approved', 'rejected')) OR
      (OLD."status" = 'rejected' AND NEW."status" = 'appealed') OR
      (OLD."status" = 'appealed' AND NEW."status" IN ('approved', 'rejected')) OR
      (OLD."status" = 'approved' AND NEW."status" = 'consumed')
    ) THEN
      RAISE EXCEPTION 'Invalid BG task evidence state transition: % -> %', OLD."status", NEW."status";
    END IF;
  END IF;
  IF NEW."status" = 'consumed' THEN
    SELECT "canonical_user_id", "action_type", "evidence_ref"
      INTO reward_user, reward_action, reward_evidence
      FROM "reward_events" WHERE "id" = NEW."consumed_reward_event_id";
    IF reward_user IS DISTINCT FROM NEW."canonical_user_id"
      OR reward_action IS DISTINCT FROM 'task_completion'
      OR reward_evidence IS DISTINCT FROM ('bg-task-evidence:' || NEW."id"::text)
    THEN
      RAISE EXCEPTION 'Consumed BG task evidence must reference its matching task reward event';
    END IF;
  END IF;
  NEW."updated_at" = now();
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_evidence_guard"
  BEFORE UPDATE OR DELETE ON "bg_task_evidence_records"
  FOR EACH ROW EXECUTE FUNCTION guard_bg_task_evidence_update();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_appeal_insert() RETURNS trigger AS $bg$
DECLARE
  evidence_user uuid;
  evidence_status varchar(20);
BEGIN
  SELECT "canonical_user_id", "status" INTO evidence_user, evidence_status
    FROM "bg_task_evidence_records" WHERE "id" = NEW."evidence_id" FOR UPDATE;
  IF evidence_user IS DISTINCT FROM NEW."appellant_user_id" OR evidence_status IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION 'Only the task owner may appeal a rejected BG task evidence record';
  END IF;
  UPDATE "bg_task_evidence_records" SET "status" = 'appealed' WHERE "id" = NEW."evidence_id";
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_appeal_insert_guard"
  BEFORE INSERT ON "bg_task_appeals"
  FOR EACH ROW EXECUTE FUNCTION guard_bg_task_appeal_insert();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_appeal_update() RETURNS trigger AS $bg$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."evidence_id" IS DISTINCT FROM OLD."evidence_id"
    OR NEW."appellant_user_id" IS DISTINCT FROM OLD."appellant_user_id"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR OLD."status" <> 'open'
    OR NEW."status" <> 'resolved'
    OR NEW."resolved_by" IS NULL
    OR NEW."resolved_at" IS NULL
    OR NEW."resolution_reason" IS NULL
    OR length(trim(NEW."resolution_reason")) = 0
  THEN
    RAISE EXCEPTION 'BG task appeal may only be resolved once; its submission is immutable';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_appeal_update_guard"
  BEFORE UPDATE ON "bg_task_appeals"
  FOR EACH ROW EXECUTE FUNCTION guard_bg_task_appeal_update();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_review_decision_insert() RETURNS trigger AS $bg$
DECLARE
  evidence_user uuid;
  evidence_status varchar(20);
  initial_reviewer uuid;
BEGIN
  SELECT "canonical_user_id", "status" INTO evidence_user, evidence_status
    FROM "bg_task_evidence_records" WHERE "id" = NEW."evidence_id" FOR UPDATE;
  IF evidence_user IS NULL OR evidence_user = NEW."reviewer_id" THEN
    RAISE EXCEPTION 'A BG task owner cannot review their own evidence';
  END IF;
  IF NEW."decision_type" = 'initial' AND evidence_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Initial BG task review requires pending_review evidence';
  END IF;
  IF NEW."decision_type" = 'appeal' THEN
    IF evidence_status <> 'appealed' THEN
      RAISE EXCEPTION 'Appeal review requires appealed evidence';
    END IF;
    SELECT "reviewer_id" INTO initial_reviewer
      FROM "bg_task_review_decisions"
      WHERE "evidence_id" = NEW."evidence_id" AND "decision_type" = 'initial';
    IF initial_reviewer IS NOT NULL AND initial_reviewer = NEW."reviewer_id" THEN
      RAISE EXCEPTION 'The initial reviewer cannot decide the appeal';
    END IF;
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_review_decision_insert_guard"
  BEFORE INSERT ON "bg_task_review_decisions"
  FOR EACH ROW EXECUTE FUNCTION guard_bg_task_review_decision_insert();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION apply_bg_task_review_decision() RETURNS trigger AS $bg$
BEGIN
  UPDATE "bg_task_evidence_records"
    SET "status" = NEW."decision"
    WHERE "id" = NEW."evidence_id";
  IF NEW."decision_type" = 'appeal' THEN
    UPDATE "bg_task_appeals"
      SET "status" = 'resolved',
          "resolved_by" = NEW."reviewer_id",
          "resolved_at" = NEW."created_at",
          "resolution_reason" = NEW."reason"
      WHERE "evidence_id" = NEW."evidence_id" AND "status" = 'open';
  END IF;
  INSERT INTO "bg_task_audit_events" ("id", "evidence_id", "actor_type", "actor_id", "action", "metadata", "created_at")
    VALUES (gen_random_uuid(), NEW."evidence_id", 'operator', NEW."reviewer_id"::text,
      'task.evidence.' || NEW."decision_type" || '.' || NEW."decision",
      jsonb_build_object('decisionId', NEW."id", 'reason', NEW."reason"), NEW."created_at");
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_review_decision_apply"
  AFTER INSERT ON "bg_task_review_decisions"
  FOR EACH ROW EXECUTE FUNCTION apply_bg_task_review_decision();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_bg_task_append_only_mutation() RETURNS trigger AS $bg$
BEGIN
  RAISE EXCEPTION 'BG task review decisions and audit events are append-only';
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_review_decisions_append_only"
  BEFORE UPDATE OR DELETE ON "bg_task_review_decisions"
  FOR EACH ROW EXECUTE FUNCTION prevent_bg_task_append_only_mutation();
--> statement-breakpoint
CREATE TRIGGER "bg_task_audit_events_append_only"
  BEFORE UPDATE OR DELETE ON "bg_task_audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_bg_task_append_only_mutation();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_evidence_insert() RETURNS trigger AS $bg$
BEGIN
  IF NEW."status" <> 'pending_review' OR NEW."consumed_reward_event_id" IS NOT NULL THEN
    RAISE EXCEPTION 'New BG task evidence must begin pending_review and unconsumed';
  END IF;
  IF length(trim(NEW."task_id")) = 0 OR NEW."task_id" !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$'
    OR length(trim(NEW."verifier_key")) = 0
    OR length(trim(NEW."source")) = 0
    OR length(trim(NEW."source_evidence_id")) = 0
    OR length(trim(NEW."idempotency_key")) = 0
  THEN
    RAISE EXCEPTION 'BG task evidence identifiers are malformed';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_evidence_insert_guard"
  BEFORE INSERT ON "bg_task_evidence_records"
  FOR EACH ROW EXECUTE FUNCTION guard_bg_task_evidence_insert();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_bg_task_evidence_insert() RETURNS trigger AS $bg$
BEGIN
  INSERT INTO "bg_task_audit_events" ("id", "evidence_id", "actor_type", "actor_id", "action", "metadata", "created_at")
    VALUES (gen_random_uuid(), NEW."id", 'service', NEW."canonical_user_id"::text,
      'task.evidence.received',
      jsonb_build_object('taskId', NEW."task_id", 'taskVersion', NEW."task_version", 'source', NEW."source", 'issuer', NEW."issuer", 'digestSha256', NEW."digest_sha256"),
      NEW."submitted_at");
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_evidence_insert_audit"
  AFTER INSERT ON "bg_task_evidence_records"
  FOR EACH ROW EXECUTE FUNCTION audit_bg_task_evidence_insert();
--> statement-breakpoint
CREATE TRIGGER "bg_task_appeals_no_delete"
  BEFORE DELETE ON "bg_task_appeals"
  FOR EACH ROW EXECUTE FUNCTION prevent_bg_task_append_only_mutation();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_evidence_update() RETURNS trigger AS $bg$
DECLARE
  reward_user uuid;
  reward_action varchar(32);
  reward_evidence varchar(256);
  valid_decision boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'BG task evidence is immutable and cannot be deleted';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."canonical_user_id" IS DISTINCT FROM OLD."canonical_user_id"
    OR NEW."task_id" IS DISTINCT FROM OLD."task_id"
    OR NEW."task_version" IS DISTINCT FROM OLD."task_version"
    OR NEW."verifier_key" IS DISTINCT FROM OLD."verifier_key"
    OR NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."issuer" IS DISTINCT FROM OLD."issuer"
    OR NEW."source_evidence_id" IS DISTINCT FROM OLD."source_evidence_id"
    OR NEW."occurred_at" IS DISTINCT FROM OLD."occurred_at"
    OR NEW."digest_sha256" IS DISTINCT FROM OLD."digest_sha256"
    OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  THEN
    RAISE EXCEPTION 'BG task evidence identity and source proof are immutable';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF OLD."status" = 'pending_review' AND NEW."status" IN ('approved', 'rejected') THEN
      SELECT EXISTS (
        SELECT 1 FROM "bg_task_review_decisions"
        WHERE "evidence_id" = NEW."id" AND "decision_type" = 'initial' AND "decision" = NEW."status"
      ) INTO valid_decision;
      IF NOT valid_decision THEN RAISE EXCEPTION 'BG task evidence review decision is required'; END IF;
    ELSIF OLD."status" = 'rejected' AND NEW."status" = 'appealed' THEN
      IF NOT EXISTS (SELECT 1 FROM "bg_task_appeals" WHERE "evidence_id" = NEW."id" AND "status" = 'open') THEN
        RAISE EXCEPTION 'An open appeal is required for this transition';
      END IF;
    ELSIF OLD."status" = 'appealed' AND NEW."status" IN ('approved', 'rejected') THEN
      SELECT EXISTS (
        SELECT 1 FROM "bg_task_review_decisions"
        WHERE "evidence_id" = NEW."id" AND "decision_type" = 'appeal' AND "decision" = NEW."status"
      ) INTO valid_decision;
      IF NOT valid_decision THEN RAISE EXCEPTION 'Independent appeal decision is required'; END IF;
    ELSIF OLD."status" = 'approved' AND NEW."status" = 'consumed' THEN
      SELECT "canonical_user_id", "action_type", "evidence_ref"
        INTO reward_user, reward_action, reward_evidence
        FROM "reward_events" WHERE "id" = NEW."consumed_reward_event_id";
      IF reward_user IS DISTINCT FROM NEW."canonical_user_id"
        OR reward_action IS DISTINCT FROM 'task_completion'
        OR reward_evidence IS DISTINCT FROM ('bg-task-evidence:' || NEW."id"::text)
      THEN
        RAISE EXCEPTION 'Consumed BG task evidence must reference its matching task reward event';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid BG task evidence state transition: % -> %', OLD."status", NEW."status";
    END IF;
  END IF;
  NEW."updated_at" = now();
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_appeal_update() RETURNS trigger AS $bg$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."evidence_id" IS DISTINCT FROM OLD."evidence_id"
    OR NEW."appellant_user_id" IS DISTINCT FROM OLD."appellant_user_id"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR OLD."status" <> 'open'
    OR NEW."status" <> 'resolved'
    OR NEW."resolved_by" IS NULL
    OR NEW."resolved_at" IS NULL
    OR NEW."resolution_reason" IS NULL
    OR length(trim(NEW."resolution_reason")) = 0
    OR NOT EXISTS (
      SELECT 1 FROM "bg_task_review_decisions"
      WHERE "evidence_id" = NEW."evidence_id"
        AND "decision_type" = 'appeal'
        AND "reviewer_id" = NEW."resolved_by"
        AND "reason" = NEW."resolution_reason"
    )
  THEN
    RAISE EXCEPTION 'BG task appeal may only be resolved by its recorded independent appeal decision';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bg_task_appeal_insert() RETURNS trigger AS $bg$
DECLARE
  evidence_user uuid;
  evidence_status varchar(20);
BEGIN
  SELECT "canonical_user_id", "status" INTO evidence_user, evidence_status
    FROM "bg_task_evidence_records" WHERE "id" = NEW."evidence_id" FOR UPDATE;
  IF evidence_user IS DISTINCT FROM NEW."appellant_user_id" OR evidence_status IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION 'Only the task owner may appeal a rejected BG task evidence record';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER "bg_task_appeal_insert_guard" ON "bg_task_appeals";
--> statement-breakpoint
CREATE TRIGGER "bg_task_appeal_insert_guard"
  AFTER INSERT ON "bg_task_appeals"
  FOR EACH ROW EXECUTE FUNCTION guard_bg_task_appeal_insert();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION transition_bg_task_appeal_to_appealed() RETURNS trigger AS $bg$
BEGIN
  UPDATE "bg_task_evidence_records" SET "status" = 'appealed' WHERE "id" = NEW."evidence_id";
  INSERT INTO "bg_task_audit_events" ("id", "evidence_id", "actor_type", "actor_id", "action", "metadata", "created_at")
    VALUES (gen_random_uuid(), NEW."evidence_id", 'user', NEW."appellant_user_id"::text,
      'task.evidence.appealed', jsonb_build_object('appealId', NEW."id"), NEW."created_at");
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_task_appeal_transition"
  AFTER INSERT ON "bg_task_appeals"
  FOR EACH ROW EXECUTE FUNCTION transition_bg_task_appeal_to_appealed();
