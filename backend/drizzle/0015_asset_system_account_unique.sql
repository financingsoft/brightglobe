CREATE UNIQUE INDEX "asset_accounts_system_uidx"
  ON "asset_accounts" USING btree ("asset_id")
  WHERE "account_type" = 'system';
