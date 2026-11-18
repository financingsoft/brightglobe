DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reward_events'::regclass
      AND conname = 'reward_events_status_check'
      AND pg_get_constraintdef(oid) LIKE '%reconciliation_required%'
  ) THEN
    RAISE EXCEPTION 'reward_events does not support reconciliation_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reward_payout_intents'::regclass
      AND conname = 'reward_payout_intents_status_check'
      AND pg_get_constraintdef(oid) LIKE '%reconciliation_required%'
  ) THEN
    RAISE EXCEPTION 'reward_payout_intents does not support reconciliation_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bg_treasury_reconciliation_runs'::regclass
      AND tgname = 'bg_treasury_reconciliation_append_only'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'BG treasury reconciliation append-only trigger is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.reward_payout_intents'::regclass
      AND tgname = 'reward_payout_state_transition'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'BG payout state transition trigger is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.reward_events'::regclass
      AND tgname = 'reward_event_state_transition'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'BG reward event state transition trigger is missing';
  END IF;
END;
$test$;
