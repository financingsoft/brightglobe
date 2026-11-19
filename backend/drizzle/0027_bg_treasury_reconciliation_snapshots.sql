CREATE TABLE public.bg_treasury_reconciliation_snapshots (
  id uuid PRIMARY KEY,
  treasury_account_id uuid NOT NULL REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT,
  network varchar(24) NOT NULL,
  mint_address varchar(44) NOT NULL,
  token_program varchar(64) NOT NULL,
  token_account_address varchar(44) NOT NULL,
  account_owner_address varchar(44),
  account_mint_address varchar(44),
  account_state varchar(16),
  observed_slot bigint,
  token_balance_base_units bigint,
  reserved_base_units bigint NOT NULL,
  paid_base_units bigint NOT NULL,
  available_after_reservations_base_units bigint,
  status varchar(24) NOT NULL,
  discrepancy_code varchar(64),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bg_treasury_reconciliation_network_check
    CHECK (network IN ('devnet', 'mainnet-beta')),
  CONSTRAINT bg_treasury_reconciliation_status_check
    CHECK (status IN ('matched', 'insufficient_inventory', 'quarantined', 'unavailable')),
  CONSTRAINT bg_treasury_reconciliation_account_state_check
    CHECK (account_state IS NULL OR account_state IN ('uninitialized', 'initialized', 'frozen')),
  CONSTRAINT bg_treasury_reconciliation_amounts_check
    CHECK (reserved_base_units >= 0 AND paid_base_units >= 0 AND
      (token_balance_base_units IS NULL OR token_balance_base_units >= 0)),
  CONSTRAINT bg_treasury_reconciliation_available_check
    CHECK (available_after_reservations_base_units IS NULL OR
      available_after_reservations_base_units = token_balance_base_units - reserved_base_units),
  CONSTRAINT bg_treasury_reconciliation_matched_check
    CHECK (status <> 'matched' OR (
      token_balance_base_units IS NOT NULL AND
      available_after_reservations_base_units IS NOT NULL AND
      available_after_reservations_base_units >= 0 AND
      account_state = 'initialized' AND
      account_owner_address IS NOT NULL AND
      account_mint_address = mint_address
    )),
  CONSTRAINT bg_treasury_reconciliation_slot_check
    CHECK (observed_slot IS NULL OR observed_slot >= 0)
);
--> statement-breakpoint
CREATE INDEX bg_treasury_reconciliation_treasury_created_idx
  ON public.bg_treasury_reconciliation_snapshots (treasury_account_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX bg_treasury_reconciliation_status_created_idx
  ON public.bg_treasury_reconciliation_snapshots (status, created_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_bg_treasury_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'BG treasury reconciliation snapshots are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER bg_treasury_reconciliation_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.bg_treasury_reconciliation_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_bg_treasury_snapshot_mutation();
