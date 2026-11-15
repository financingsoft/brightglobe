INSERT INTO "asset_registry" (
  "id",
  "asset_code",
  "network",
  "token_program",
  "mint_address",
  "decimals",
  "status",
  "metadata_source"
) VALUES (
  '019a8e5a-4a00-7000-8000-000000000001',
  'BG',
  'devnet',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  NULL,
  NULL,
  'draft',
  'unconfigured'
)
ON CONFLICT ("asset_code", "network") DO NOTHING;
