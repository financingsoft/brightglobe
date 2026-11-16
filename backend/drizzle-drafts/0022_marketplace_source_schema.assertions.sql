-- Run only against a disposable PostgreSQL database after applying
-- 0022_marketplace_source_schema.sql. This file is an assertion suite, not DDL.
DO $assertions$
DECLARE
  v_table_count integer;
  v_canonical_fk_count integer;
BEGIN
  SELECT count(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'marketplace' AND table_type = 'BASE TABLE';
  IF v_table_count <> 22 THEN
    RAISE EXCEPTION 'expected 22 marketplace source tables, found %', v_table_count;
  END IF;

  SELECT count(*) INTO v_canonical_fk_count
  FROM pg_constraint c
  JOIN pg_class source_table ON source_table.oid = c.conrelid
  JOIN pg_namespace source_schema ON source_schema.oid = source_table.relnamespace
  JOIN pg_class target_table ON target_table.oid = c.confrelid
  JOIN pg_namespace target_schema ON target_schema.oid = target_table.relnamespace
  WHERE c.contype = 'f'
    AND source_schema.nspname = 'marketplace'
    AND target_schema.nspname = 'public'
    AND target_table.relname = 'canonical_users';
  IF v_canonical_fk_count < 8 THEN
    RAISE EXCEPTION 'expected canonical user foreign keys, found %', v_canonical_fk_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class source_table ON source_table.oid = c.conrelid
    JOIN pg_namespace source_schema ON source_schema.oid = source_table.relnamespace
    JOIN pg_class target_table ON target_table.oid = c.confrelid
    JOIN pg_namespace target_schema ON target_schema.oid = target_table.relnamespace
    WHERE c.contype = 'f'
      AND source_schema.nspname = 'marketplace'
      AND target_schema.nspname = 'public'
      AND target_table.relname = 'user'
  ) THEN
    RAISE EXCEPTION 'Marketplace business tables must not reference Better Auth public.user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'marketplace'
      AND indexname = 'reviews_one_unless_repost_allowed_uidx'
      AND indexdef ILIKE '%WHERE (repost_allowed_at IS NULL)%'
  ) THEN
    RAISE EXCEPTION 'missing partial unique index for active app reviews';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'developer_owner_invariant_membership'
      AND tgisconstraint
      AND tgdeferrable
  ) THEN
    RAISE EXCEPTION 'missing deferred developer owner invariant trigger';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_events_append_only_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'missing append-only audit trigger';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'app_listing_publication_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'missing listing publication guard';
  END IF;

  RAISE NOTICE 'Marketplace V1 schema assertions passed.';
END;
$assertions$;
