CREATE OR REPLACE FUNCTION public.apply_asset_ledger_posting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.asset_accounts
  SET
    balance_base_units = balance_base_units + NEW.delta_base_units,
    updated_at = now()
  WHERE id = NEW.account_id
    AND (
      account_type <> 'user' OR
      balance_base_units + NEW.delta_base_units >= 0
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset account does not exist or user balance would become negative';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_asset_account_balance_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.balance_base_units IS DISTINCT FROM OLD.balance_base_units
     AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Asset account balances can only change through ledger postings';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "asset_ledger_posting_apply_balance"
AFTER INSERT ON "asset_ledger_postings"
FOR EACH ROW EXECUTE FUNCTION public.apply_asset_ledger_posting();
--> statement-breakpoint
CREATE TRIGGER "asset_accounts_balance_guard"
BEFORE UPDATE OF "balance_base_units" ON "asset_accounts"
FOR EACH ROW EXECUTE FUNCTION public.guard_asset_account_balance_update();
