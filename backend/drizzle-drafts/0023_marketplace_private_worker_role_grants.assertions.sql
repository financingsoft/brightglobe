-- Assertions for the private developer Worker role grants.
-- Run only against the disposable PostgreSQL CI database after applying
-- 0022_marketplace_source_schema.sql and 0023_marketplace_private_worker_role_grants.sql.
DO $assertions$
DECLARE
  v_role name := 'brightglobe_play_developer_app';
BEGIN
  IF NOT has_schema_privilege(v_role, 'marketplace', 'USAGE') THEN
    RAISE EXCEPTION 'private developer role must have Marketplace schema usage';
  END IF;
  IF NOT has_table_privilege(v_role, 'public."user"', 'SELECT')
     OR NOT has_table_privilege(v_role, 'public."session"', 'SELECT') THEN
    RAISE EXCEPTION 'private developer role must read Better Auth session identity';
  END IF;
  IF NOT has_column_privilege(v_role, 'public."session"', 'updated_at', 'UPDATE')
     OR has_column_privilege(v_role, 'public."session"', 'token', 'UPDATE') THEN
    RAISE EXCEPTION 'Better Auth session update must be limited to updated_at';
  END IF;

  IF NOT has_column_privilege(v_role, 'public.canonical_users', 'id', 'INSERT')
     OR has_column_privilege(v_role, 'public.canonical_users', 'status', 'INSERT') THEN
    RAISE EXCEPTION 'canonical user provisioning must use the database active-status default';
  END IF;
  IF NOT has_column_privilege(v_role, 'public.provider_identities', 'verified_at', 'UPDATE')
     OR has_column_privilege(v_role, 'public.provider_identities', 'provider_subject', 'UPDATE') THEN
    RAISE EXCEPTION 'provider identity updates must be limited to verified_at';
  END IF;
  IF NOT has_column_privilege(v_role, 'public.wallet_sessions', 'last_seen_at', 'UPDATE')
     OR has_column_privilege(v_role, 'public.wallet_sessions', 'revoked_at', 'UPDATE') THEN
    RAISE EXCEPTION 'wallet session updates must be limited to last_seen_at';
  END IF;

  IF NOT has_table_privilege(v_role, 'marketplace.developers', 'SELECT')
     OR NOT has_column_privilege(v_role, 'marketplace.developers', 'slug', 'INSERT')
     OR has_column_privilege(v_role, 'marketplace.developers', 'status', 'INSERT')
     OR has_column_privilege(v_role, 'marketplace.developers', 'verification_status', 'INSERT')
     OR NOT has_column_privilege(v_role, 'marketplace.developers', 'updated_at', 'UPDATE')
     OR has_column_privilege(v_role, 'marketplace.developers', 'status', 'UPDATE')
     OR has_table_privilege(v_role, 'marketplace.developers', 'DELETE') THEN
    RAISE EXCEPTION 'developer organization grants exceed the required create/read scope';
  END IF;
  IF NOT has_column_privilege(v_role, 'marketplace.developer_memberships', 'role', 'UPDATE')
     OR NOT has_column_privilege(v_role, 'marketplace.developer_memberships', 'status', 'UPDATE')
     OR has_column_privilege(v_role, 'marketplace.developer_memberships', 'created_by_canonical_user_id', 'UPDATE')
     OR has_table_privilege(v_role, 'marketplace.developer_memberships', 'DELETE') THEN
    RAISE EXCEPTION 'membership grants exceed the required transfer/status scope';
  END IF;
  IF NOT has_column_privilege(v_role, 'marketplace.developer_invitations', 'accepted_at', 'UPDATE')
     OR NOT has_column_privilege(v_role, 'marketplace.developer_invitations', 'revoked_at', 'UPDATE')
     OR has_column_privilege(v_role, 'marketplace.developer_invitations', 'normalized_email', 'UPDATE')
     OR has_table_privilege(v_role, 'marketplace.developer_invitations', 'DELETE') THEN
    RAISE EXCEPTION 'invitation grants exceed the required accept/revoke scope';
  END IF;
  IF NOT has_column_privilege(v_role, 'marketplace.audit_events', 'action', 'INSERT')
     OR has_table_privilege(v_role, 'marketplace.audit_events', 'SELECT')
     OR has_table_privilege(v_role, 'marketplace.audit_events', 'UPDATE')
     OR has_table_privilege(v_role, 'marketplace.audit_events', 'DELETE') THEN
    RAISE EXCEPTION 'audit events must be append-only for the private Worker';
  END IF;

  IF has_table_privilege(v_role, 'marketplace.apps', 'SELECT')
     OR has_table_privilege(v_role, 'marketplace.app_artifacts', 'INSERT')
     OR has_table_privilege(v_role, 'marketplace.domain_outbox', 'INSERT') THEN
    RAISE EXCEPTION 'private developer role must not access app/release/outbox source tables';
  END IF;
  IF has_schema_privilege(v_role, 'marketplace', 'CREATE')
     OR has_database_privilege(v_role, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'private developer role must not have DDL privileges';
  END IF;

  RAISE NOTICE 'Private developer Worker privilege assertions passed.';
END;
$assertions$;
