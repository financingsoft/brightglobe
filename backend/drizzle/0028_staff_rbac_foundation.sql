CREATE TABLE public.staff_principals (
  id uuid PRIMARY KEY,
  auth_user_id text NOT NULL UNIQUE REFERENCES public."user"(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'pending',
  display_label varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_principals_status_check CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  CONSTRAINT staff_principals_display_label_check CHECK (length(trim(display_label)) BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY,
  role_key varchar(64) NOT NULL UNIQUE,
  display_name varchar(120) NOT NULL,
  description varchar(500) NOT NULL DEFAULT '',
  status varchar(16) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_roles_status_check CHECK (status IN ('active', 'disabled')),
  CONSTRAINT staff_roles_key_check CHECK (role_key ~ '^[a-z][a-z0-9_.-]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE public.staff_permissions (
  id uuid PRIMARY KEY,
  permission_key varchar(96) NOT NULL UNIQUE,
  description varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_permissions_key_check CHECK (permission_key ~ '^[a-z][a-z0-9_.-]{1,95}$')
);
--> statement-breakpoint
CREATE TABLE public.staff_role_permissions (
  role_id uuid NOT NULL REFERENCES public.staff_roles(id) ON DELETE RESTRICT,
  permission_id uuid NOT NULL REFERENCES public.staff_permissions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
--> statement-breakpoint
CREATE TABLE public.staff_role_assignments (
  id uuid PRIMARY KEY,
  staff_principal_id uuid NOT NULL REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES public.staff_roles(id) ON DELETE RESTRICT,
  granted_by_staff_id uuid REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'active',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_role_assignments_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT staff_role_assignments_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT staff_role_assignments_revoked_check CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX staff_role_assignments_active_uidx
  ON public.staff_role_assignments (staff_principal_id, role_id)
  WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX staff_role_assignments_principal_status_idx
  ON public.staff_role_assignments (staff_principal_id, status, valid_from, valid_until);
--> statement-breakpoint
CREATE TABLE public.staff_audit_events (
  id uuid PRIMARY KEY,
  actor_staff_id uuid REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  subject_staff_id uuid REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  action varchar(96) NOT NULL,
  reason varchar(1000) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_audit_events_reason_check CHECK (length(trim(reason)) BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE INDEX staff_audit_events_actor_created_idx
  ON public.staff_audit_events (actor_staff_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX staff_audit_events_subject_created_idx
  ON public.staff_audit_events (subject_staff_id, created_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_staff_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Staff audit events are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER staff_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.staff_audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_staff_audit_mutation();
--> statement-breakpoint
INSERT INTO public.staff_roles (id, role_key, display_name, description) VALUES
  ('b0000000-0000-7000-8000-000000000001', 'treasury_observer', 'Treasury Observer', 'Read-only access to treasury status and reconciliation evidence.'),
  ('b0000000-0000-7000-8000-000000000002', 'treasury_recovery_proposer', 'Treasury Recovery Proposer', 'May propose a controlled treasury recovery.'),
  ('b0000000-0000-7000-8000-000000000003', 'treasury_recovery_approver', 'Treasury Recovery Approver', 'May independently approve a controlled treasury recovery.'),
  ('b0000000-0000-7000-8000-000000000004', 'rewards_reviewer', 'Rewards Reviewer', 'May review reward evidence and appeals.')
ON CONFLICT (role_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.staff_permissions (id, permission_key, description) VALUES
  ('b1000000-0000-7000-8000-000000000001', 'bg.treasury.read', 'Read treasury status and reconciliation snapshots.'),
  ('b1000000-0000-7000-8000-000000000002', 'bg.treasury.recovery.propose', 'Propose a treasury recovery.'),
  ('b1000000-0000-7000-8000-000000000003', 'bg.treasury.recovery.approve', 'Independently approve a treasury recovery.'),
  ('b1000000-0000-7000-8000-000000000004', 'bg.rewards.evidence.review', 'Review initial BG reward evidence.'),
  ('b1000000-0000-7000-8000-000000000005', 'bg.rewards.appeal.review', 'Review BG reward evidence appeals.')
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.staff_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('treasury_observer', 'bg.treasury.read'),
  ('treasury_recovery_proposer', 'bg.treasury.read'),
  ('treasury_recovery_proposer', 'bg.treasury.recovery.propose'),
  ('treasury_recovery_approver', 'bg.treasury.read'),
  ('treasury_recovery_approver', 'bg.treasury.recovery.approve'),
  ('rewards_reviewer', 'bg.rewards.evidence.review'),
  ('rewards_reviewer', 'bg.rewards.appeal.review')
) AS grants(role_key, permission_key)
JOIN public.staff_roles r ON r.role_key = grants.role_key
JOIN public.staff_permissions p ON p.permission_key = grants.permission_key
ON CONFLICT DO NOTHING;
