ALTER TABLE public.staff_step_up_grants
  DROP CONSTRAINT staff_step_up_operation_check;
--> statement-breakpoint
ALTER TABLE public.staff_step_up_grants
  ADD CONSTRAINT staff_step_up_operation_check CHECK (
    operation IN (
      'bg.treasury.recovery.propose',
      'bg.treasury.recovery.approve',
      'bg.treasury.recovery.execute'
    )
  );
--> statement-breakpoint
INSERT INTO public.staff_permissions (id, permission_key, description) VALUES
  ('b1000000-0000-7000-8000-000000000006', 'bg.treasury.recovery.execute', 'Execute an approved Devnet Treasury recovery after fresh reconciliation and independent approval.')
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.staff_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.staff_roles r
JOIN public.staff_permissions p ON p.permission_key = 'bg.treasury.recovery.execute'
WHERE r.role_key = 'treasury_recovery_approver'
ON CONFLICT DO NOTHING;
