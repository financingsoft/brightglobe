BEGIN;
INSERT INTO "canonical_users" ("id") VALUES
  ('019a8e5a-4a00-7000-8000-000000000001'),
  ('019a8e5a-4a00-7000-8000-000000000002'),
  ('019a8e5a-4a00-7000-8000-000000000003');
INSERT INTO "bg_task_evidence_records"
  ("id", "canonical_user_id", "task_id", "task_version", "verifier_key", "source", "issuer", "source_evidence_id", "occurred_at", "digest_sha256", "idempotency_key")
VALUES
  ('019a8e5a-4a00-7000-8000-000000000011', '019a8e5a-4a00-7000-8000-000000000001', 'profile.complete', 1, 'profile-v1', 'brightglobe.profile', 'brightglobe-server', 'profile-event-1', now(), repeat('a', 64), 'bg-task:user1:profile:1'),
  ('019a8e5a-4a00-7000-8000-000000000012', '019a8e5a-4a00-7000-8000-000000000001', 'invite.qualify', 1, 'invite-v1', 'brightglobe.invite', 'brightglobe-server', 'invite-event-1', now(), repeat('b', 64), 'bg-task:user1:invite:1');

DO $test$
DECLARE
  blocked boolean;
BEGIN
  blocked := false;
  BEGIN
    INSERT INTO "bg_task_evidence_records"
      ("id", "canonical_user_id", "task_id", "task_version", "verifier_key", "source", "issuer", "source_evidence_id", "occurred_at", "digest_sha256", "idempotency_key")
    VALUES
      ('019a8e5a-4a00-7000-8000-000000000013', '019a8e5a-4a00-7000-8000-000000000002', 'profile.complete', 1, 'profile-v1', 'brightglobe.profile', 'brightglobe-server', 'profile-event-1', now(), repeat('c', 64), 'bg-task:user2:profile:1');
  EXCEPTION WHEN unique_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'cross-user source evidence replay was not blocked'; END IF;

  blocked := false;
  BEGIN
    UPDATE "bg_task_evidence_records" SET "task_id" = 'tampered' WHERE "id" = '019a8e5a-4a00-7000-8000-000000000011';
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'immutable evidence identity was mutable'; END IF;

  blocked := false;
  BEGIN
    INSERT INTO "bg_task_review_decisions" ("id", "evidence_id", "decision_type", "decision", "reviewer_id", "reason")
    VALUES ('019a8e5a-4a00-7000-8000-000000000021', '019a8e5a-4a00-7000-8000-000000000011', 'initial', 'approved', '019a8e5a-4a00-7000-8000-000000000001', 'self approval attempt');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'self-review was not blocked'; END IF;
END;
$test$;

INSERT INTO "bg_task_review_decisions"
  ("id", "evidence_id", "decision_type", "decision", "reviewer_id", "reason")
VALUES
  ('019a8e5a-4a00-7000-8000-000000000022', '019a8e5a-4a00-7000-8000-000000000011', 'initial', 'approved', '019a8e5a-4a00-7000-8000-000000000002', 'Evidence matches the server record.'),
  ('019a8e5a-4a00-7000-8000-000000000023', '019a8e5a-4a00-7000-8000-000000000012', 'initial', 'rejected', '019a8e5a-4a00-7000-8000-000000000002', 'Evidence does not meet the policy.');
INSERT INTO "bg_task_appeals" ("id", "evidence_id", "appellant_user_id", "reason")
VALUES ('019a8e5a-4a00-7000-8000-000000000031', '019a8e5a-4a00-7000-8000-000000000012', '019a8e5a-4a00-7000-8000-000000000001', 'Please re-check the source record.');

DO $test$
DECLARE
  blocked boolean;
BEGIN
  blocked := false;
  BEGIN
    INSERT INTO "bg_task_review_decisions" ("id", "evidence_id", "decision_type", "decision", "reviewer_id", "reason")
    VALUES ('019a8e5a-4a00-7000-8000-000000000024', '019a8e5a-4a00-7000-8000-000000000012', 'appeal', 'approved', '019a8e5a-4a00-7000-8000-000000000002', 'same reviewer appeal attempt');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'initial reviewer was allowed to decide appeal'; END IF;
END;
$test$;

INSERT INTO "bg_task_review_decisions"
  ("id", "evidence_id", "decision_type", "decision", "reviewer_id", "reason")
VALUES ('019a8e5a-4a00-7000-8000-000000000025', '019a8e5a-4a00-7000-8000-000000000012', 'appeal', 'approved', '019a8e5a-4a00-7000-8000-000000000003', 'Independent appeal review accepted.');

DO $test$
DECLARE
  approved_count integer;
  resolved_count integer;
  audit_count integer;
  blocked boolean;
BEGIN
  SELECT count(*) INTO approved_count FROM "bg_task_evidence_records" WHERE "status" = 'approved';
  SELECT count(*) INTO resolved_count FROM "bg_task_appeals" WHERE "status" = 'resolved' AND "resolved_by" = '019a8e5a-4a00-7000-8000-000000000003';
  SELECT count(*) INTO audit_count FROM "bg_task_audit_events";
  IF approved_count <> 2 OR resolved_count <> 1 OR audit_count < 5 THEN
    RAISE EXCEPTION 'BG task review/appeal state or audit history was not applied';
  END IF;
  blocked := false;
  BEGIN
    DELETE FROM "bg_task_audit_events" WHERE "evidence_id" = '019a8e5a-4a00-7000-8000-000000000011';
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'append-only task audit was deletable'; END IF;
END;
$test$;
ROLLBACK;
