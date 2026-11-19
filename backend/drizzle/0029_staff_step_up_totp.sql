ALTER TABLE public."user"
  ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE public.two_factor (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  failed_verification_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  CONSTRAINT two_factor_failed_count_check CHECK (failed_verification_count >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX two_factor_user_id_uidx ON public.two_factor (user_id);
--> statement-breakpoint
CREATE TABLE public.staff_step_up_grants (
  id uuid PRIMARY KEY,
  staff_principal_id uuid NOT NULL REFERENCES public.staff_principals(id) ON DELETE RESTRICT,
  auth_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  session_id text NOT NULL,
  operation varchar(96) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT staff_step_up_operation_check CHECK (
    operation IN ('bg.treasury.recovery.propose', 'bg.treasury.recovery.approve')
  ),
  CONSTRAINT staff_step_up_token_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT staff_step_up_expiry_check CHECK (expires_at > issued_at),
  CONSTRAINT staff_step_up_consumed_check CHECK (consumed_at IS NULL OR consumed_at >= issued_at)
);
--> statement-breakpoint
CREATE INDEX staff_step_up_grants_subject_operation_idx
  ON public.staff_step_up_grants (staff_principal_id, session_id, operation, expires_at)
  WHERE consumed_at IS NULL;
