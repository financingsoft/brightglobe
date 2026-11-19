ALTER TABLE public.staff_step_up_grants
  DROP CONSTRAINT staff_step_up_operation_check;
--> statement-breakpoint
ALTER TABLE public.staff_step_up_grants
  ADD CONSTRAINT staff_step_up_operation_check CHECK (
    operation IN (
      'bg.treasury.recovery.propose',
      'bg.treasury.recovery.approve',
      'bg.treasury.recovery.execute',
      'bg.staff.access.propose',
      'bg.staff.access.approve',
      'bg.staff.access.execute'
    )
  );
--> statement-breakpoint
INSERT INTO public.staff_permissions (id, permission_key, description) VALUES
  ('b1000000-0000-7000-8000-000000000007', 'bg.staff.access.read', 'Read staff principals, role templates, and access change requests.'),
  ('b1000000-0000-7000-8000-000000000008', 'bg.staff.access.propose', 'Propose staff provisioning, role assignment/revocation, or suspension.'),
  ('b1000000-0000-7000-8000-000000000009', 'bg.staff.access.approve', 'Independently approve staff access changes.'),
  ('b1000000-0000-7000-8000-000000000010', 'bg.staff.access.execute', 'Execute an approved staff access change.')
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.staff_roles (id, role_key, display_name, description) VALUES
  ('b0000000-0000-7000-8000-000000000005', 'staff_access_proposer', 'Staff Access Proposer', 'May propose controlled staff access changes.'),
  ('b0000000-0000-7000-8000-000000000006', 'staff_access_approver', 'Staff Access Approver', 'May independently approve and execute staff access changes.')
ON CONFLICT (role_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.staff_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('staff_access_proposer', 'bg.staff.access.read'),
  ('staff_access_proposer', 'bg.staff.access.propose'),
  ('staff_access_approver', 'bg.staff.access.read'),
  ('staff_access_approver', 'bg.staff.access.approve'),
  ('staff_access_approver', 'bg.staff.access.execute')
) AS grants(role_key, permission_key)
JOIN public.staff_roles r ON r.role_key = grants.role_key
JOIN public.staff_permissions p ON p.permission_key = grants.permission_key
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE public.staff_access_change_requests (
  id uuid PRIMARY KEY,
  action varchar(32) NOT NULL,
  target_auth_user_id text REFERENCES public."user"(id) ON DELETE RESTRICT,
  target_staff_principal_id uuid REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  role_id uuid REFERENCES public.staff_roles(id) ON DELETE RESTRICT,
  display_label varchar(120),
  valid_until timestamptz,
  proposer_staff_id uuid NOT NULL REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  approver_staff_id uuid REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'pending',
  reason varchar(1000) NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  consumed_at timestamptz,
  CONSTRAINT staff_access_change_action_check
    CHECK (action IN ('provision_principal', 'assign_role', 'revoke_role', 'suspend_principal')),
  CONSTRAINT staff_access_change_status_check
    CHECK (status IN ('pending', 'approved', 'expired', 'consumed')),
  CONSTRAINT staff_access_change_reason_check
    CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  CONSTRAINT staff_access_change_idempotency_check
    CHECK (length(trim(idempotency_key)) BETWEEN 16 AND 128),
  CONSTRAINT staff_access_change_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT staff_access_change_valid_until_check
    CHECK (valid_until IS NULL OR valid_until > created_at),
  CONSTRAINT staff_access_change_separation_check
    CHECK (approver_staff_id IS NULL OR approver_staff_id <> proposer_staff_id),
  CONSTRAINT staff_access_change_approval_check
    CHECK (
      (status IN ('pending', 'expired') AND approver_staff_id IS NULL AND approved_at IS NULL AND consumed_at IS NULL)
      OR (status = 'approved' AND approver_staff_id IS NOT NULL AND approved_at IS NOT NULL AND consumed_at IS NULL)
      OR (status = 'consumed' AND approver_staff_id IS NOT NULL AND approved_at IS NOT NULL AND consumed_at IS NOT NULL)
    ),
  CONSTRAINT staff_access_change_action_shape_check
    CHECK (
      (action = 'provision_principal' AND target_auth_user_id IS NOT NULL AND target_staff_principal_id IS NULL AND role_id IS NOT NULL AND display_label IS NOT NULL)
      OR (action = 'assign_role' AND target_auth_user_id IS NULL AND target_staff_principal_id IS NOT NULL AND role_id IS NOT NULL AND display_label IS NULL)
      OR (action = 'revoke_role' AND target_auth_user_id IS NULL AND target_staff_principal_id IS NOT NULL AND role_id IS NOT NULL AND display_label IS NULL)
      OR (action = 'suspend_principal' AND target_auth_user_id IS NULL AND target_staff_principal_id IS NOT NULL AND role_id IS NULL AND display_label IS NULL)
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX staff_access_change_requests_idempotency_uidx
  ON public.staff_access_change_requests (proposer_staff_id, idempotency_key);
--> statement-breakpoint
CREATE INDEX staff_access_change_requests_status_created_idx
  ON public.staff_access_change_requests (status, created_at DESC);
--> statement-breakpoint
CREATE INDEX staff_access_change_requests_target_status_idx
  ON public.staff_access_change_requests (target_staff_principal_id, status, created_at DESC);
