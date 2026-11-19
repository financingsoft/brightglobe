CREATE TABLE public.bg_treasury_recovery_proposals (
  id uuid PRIMARY KEY,
  treasury_account_id uuid NOT NULL REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT,
  snapshot_id uuid NOT NULL REFERENCES public.bg_treasury_reconciliation_snapshots(id) ON DELETE RESTRICT,
  proposer_staff_id uuid NOT NULL REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  approver_staff_id uuid REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'pending',
  reason varchar(1000) NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  consumed_at timestamptz,
  CONSTRAINT bg_treasury_recovery_proposals_status_check
    CHECK (status IN ('pending', 'approved', 'expired', 'consumed')),
  CONSTRAINT bg_treasury_recovery_proposals_reason_check
    CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  CONSTRAINT bg_treasury_recovery_proposals_idempotency_check
    CHECK (length(trim(idempotency_key)) BETWEEN 16 AND 128),
  CONSTRAINT bg_treasury_recovery_proposals_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT bg_treasury_recovery_proposals_separation_check
    CHECK (approver_staff_id IS NULL OR approver_staff_id <> proposer_staff_id),
  CONSTRAINT bg_treasury_recovery_proposals_approval_check
    CHECK (
      (status IN ('pending', 'expired') AND approver_staff_id IS NULL AND approved_at IS NULL AND consumed_at IS NULL)
      OR (status = 'approved' AND approver_staff_id IS NOT NULL AND approved_at IS NOT NULL AND consumed_at IS NULL)
      OR (status = 'consumed' AND approver_staff_id IS NOT NULL AND approved_at IS NOT NULL AND consumed_at IS NOT NULL)
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX bg_treasury_recovery_proposals_idempotency_uidx
  ON public.bg_treasury_recovery_proposals (proposer_staff_id, idempotency_key);
--> statement-breakpoint
CREATE UNIQUE INDEX bg_treasury_recovery_proposals_pending_treasury_uidx
  ON public.bg_treasury_recovery_proposals (treasury_account_id)
  WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX bg_treasury_recovery_proposals_snapshot_status_idx
  ON public.bg_treasury_recovery_proposals (snapshot_id, status, created_at DESC);
--> statement-breakpoint
CREATE INDEX bg_treasury_recovery_proposals_approver_created_idx
  ON public.bg_treasury_recovery_proposals (approver_staff_id, created_at DESC);
