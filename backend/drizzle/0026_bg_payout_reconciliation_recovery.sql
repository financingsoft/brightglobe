DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.reward_payout_intents
    WHERE status IN ('signed', 'submitted', 'confirmed', 'finalized', 'paid', 'reconciliation_required')
      AND (
        chain_signature IS NULL OR
        recent_blockhash IS NULL OR
        last_valid_block_height IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'BG payout reconciliation migration blocked: persisted payout signature or blockhash evidence is incomplete; audit affected rows before retrying';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.reward_payout_intents
  ADD CONSTRAINT reward_payout_intents_reconciliation_signature_check
  CHECK (
    status NOT IN ('signed', 'submitted', 'confirmed', 'finalized', 'paid', 'reconciliation_required')
    OR (
      chain_signature IS NOT NULL AND
      recent_blockhash IS NOT NULL AND
      last_valid_block_height IS NOT NULL
    )
  );
--> statement-breakpoint
CREATE INDEX reward_payout_intents_reconciliation_due_idx
  ON public.reward_payout_intents (retry_after, created_at)
  WHERE network = 'devnet'
    AND status IN ('signed', 'submitted', 'confirmed', 'finalized', 'reconciliation_required');
