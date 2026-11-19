import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  image: text("image"),
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
}, (table) => [index("session_user_id_idx").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("account_user_id_idx").on(table.userId),
  uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").notNull().default(false),
  failedVerificationCount: integer("failed_verification_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true })
}, (table) => [
  uniqueIndex("two_factor_user_id_uidx").on(table.userId),
  check("two_factor_failed_count_check", sql`${table.failedVerificationCount} >= 0`)
]);

export const userProfile = pgTable("user_profile", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 48 }).notNull(),
  locale: varchar("locale", { length: 16 }).notNull().default("en-US"),
  timeZone: varchar("time_zone", { length: 64 }),
  countryCode: varchar("country_code", { length: 2 }),
  avatarUrl: text("avatar_url"),
  bio: varchar("bio", { length: 160 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});


/**
 * Canonical BrightGlobe identity tables. These are intentionally independent
 * from Better Auth's provider-local user IDs and from the legacy BD schema.
 */
export const canonicalUsers = pgTable("canonical_users", {
  id: uuid("id").primaryKey(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("canonical_users_status_check", sql`${table.status} IN ('active', 'suspended', 'closed')`),
  index("canonical_users_status_idx").on(table.status)
]);

export const providerIdentities = pgTable("provider_identities", {
  id: uuid("id").primaryKey(),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerSubject: varchar("provider_subject", { length: 256 }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("provider_identities_provider_subject_uidx").on(table.provider, table.providerSubject),
  index("provider_identities_canonical_user_idx").on(table.canonicalUserId),
  check("provider_identities_provider_check", sql`${table.provider} IN ('better_auth_email', 'solana_wallet')`)
]);

export const walletOwnerships = pgTable("wallet_ownerships", {
  id: uuid("id").primaryKey(),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  network: varchar("network", { length: 24 }).notNull(),
  address: varchar("address", { length: 44 }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("wallet_ownerships_network_address_uidx").on(table.network, table.address),
  index("wallet_ownerships_canonical_user_idx").on(table.canonicalUserId),
  check("wallet_ownerships_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`)
]);

export const identityAuditEvents = pgTable("identity_audit_events", {
  id: uuid("id").primaryKey(),
  canonicalUserId: uuid("canonical_user_id").references(() => canonicalUsers.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  actorType: varchar("actor_type", { length: 24 }).notNull(),
  actorId: varchar("actor_id", { length: 256 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("identity_audit_events_user_created_idx").on(table.canonicalUserId, table.createdAt),
  index("identity_audit_events_type_created_idx").on(table.eventType, table.createdAt)
]);


export const canonicalUserProfiles = pgTable("canonical_user_profiles", {
  canonicalUserId: uuid("canonical_user_id").primaryKey().references(() => canonicalUsers.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 48 }).notNull(),
  locale: varchar("locale", { length: 16 }).notNull().default("en-US"),
  timeZone: varchar("time_zone", { length: 64 }),
  countryCode: varchar("country_code", { length: 2 }),
  avatarUrl: text("avatar_url"),
  bio: varchar("bio", { length: 160 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("canonical_user_profiles_country_check", sql.raw("country_code IS NULL OR country_code ~ '^[A-Z]{2}$'")),
  check("canonical_user_profiles_locale_check", sql.raw("locale ~ '^[a-z]{2}(-[A-Z]{2})?$'")),
  check("canonical_user_profiles_avatar_https_check", sql.raw("avatar_url IS NULL OR avatar_url ~ '^https://'"))
]);

export const walletChallenges = pgTable("wallet_challenges", {
  id: uuid("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
  network: varchar("network", { length: 24 }).notNull(),
  purpose: varchar("purpose", { length: 16 }).notNull().default("sign_in"),
  canonicalUserId: uuid("canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  requestIp: varchar("request_ip", { length: 64 }),
  verificationAttempts: integer("verification_attempts").notNull().default(0),
  origin: text("origin").notNull(),
  uri: text("uri").notNull(),
  nonceHash: varchar("nonce_hash", { length: 64 }).notNull(),
  message: text("message").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("wallet_challenges_expiry_idx").on(table.expiresAt),
  index("wallet_challenges_wallet_created_idx").on(table.network, table.walletAddress, table.createdAt),
  check("wallet_challenges_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`),
  check("wallet_challenges_purpose_check", sql.raw("purpose IN ('sign_in', 'link')")),
  check("wallet_challenges_link_target_check", sql.raw("(purpose = 'sign_in' AND canonical_user_id IS NULL) OR (purpose = 'link' AND canonical_user_id IS NOT NULL)")),
  index("wallet_challenges_ip_created_idx").on(table.requestIp, table.createdAt),
  check("wallet_challenges_attempts_check", sql.raw("verification_attempts >= 0 AND verification_attempts <= 8"))
]);

export const walletSessions = pgTable("wallet_sessions", {
  id: uuid("id").primaryKey(),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: varchar("user_agent", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("wallet_sessions_token_hash_uidx").on(table.tokenHash),
  index("wallet_sessions_user_created_idx").on(table.canonicalUserId, table.createdAt),
  index("wallet_sessions_expiry_idx").on(table.expiresAt)
]);


export const assetRegistry = pgTable("asset_registry", {
  id: uuid("id").primaryKey(),
  assetCode: varchar("asset_code", { length: 16 }).notNull(),
  network: varchar("network", { length: 24 }).notNull(),
  tokenProgram: varchar("token_program", { length: 64 }).notNull(),
  mintAddress: varchar("mint_address", { length: 44 }),
  decimals: integer("decimals"),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  metadataSource: varchar("metadata_source", { length: 32 }).notNull().default("unconfigured"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("asset_registry_code_network_uidx").on(table.assetCode, table.network),
  check("asset_registry_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`),
  check("asset_registry_status_check", sql`${table.status} IN ('draft', 'active', 'retired')`),
  check("asset_registry_decimals_check", sql`${table.decimals} IS NULL OR (${table.decimals} >= 0 AND ${table.decimals} <= 255)`),
  check("asset_registry_mint_status_check", sql`${table.status} <> 'active' OR (${table.mintAddress} IS NOT NULL AND ${table.decimals} IS NOT NULL)`)
]);

export const assetAccounts = pgTable("asset_accounts", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assetRegistry.id, { onDelete: "restrict" }),
  canonicalUserId: uuid("canonical_user_id").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  accountType: varchar("account_type", { length: 16 }).notNull(),
  balanceBaseUnits: bigint("balance_base_units", { mode: "bigint" }).notNull().default(0n),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("asset_accounts_user_asset_uidx").on(table.assetId, table.canonicalUserId).where(sql`${table.canonicalUserId} IS NOT NULL`),
  uniqueIndex("asset_accounts_system_uidx").on(table.assetId).where(sql.raw("account_type = 'system'")),
  index("asset_accounts_asset_type_idx").on(table.assetId, table.accountType),
  check("asset_accounts_type_owner_check", sql`(${table.accountType} = 'user' AND ${table.canonicalUserId} IS NOT NULL) OR (${table.accountType} = 'system' AND ${table.canonicalUserId} IS NULL)`),
  check("asset_accounts_user_balance_nonnegative_check", sql`${table.accountType} <> 'user' OR ${table.balanceBaseUnits} >= 0`)
]);

export const assetLedgerTransactions = pgTable("asset_ledger_transactions", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assetRegistry.id, { onDelete: "restrict" }),
  transactionType: varchar("transaction_type", { length: 40 }).notNull(),
  referenceType: varchar("reference_type", { length: 64 }).notNull(),
  referenceId: varchar("reference_id", { length: 256 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("asset_ledger_transactions_asset_created_idx").on(table.assetId, table.createdAt)
]);

export const assetLedgerPostings = pgTable("asset_ledger_postings", {
  id: uuid("id").primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => assetLedgerTransactions.id, { onDelete: "restrict" }),
  accountId: uuid("account_id").notNull().references(() => assetAccounts.id, { onDelete: "restrict" }),
  deltaBaseUnits: bigint("delta_base_units", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("asset_ledger_postings_transaction_idx").on(table.transactionId),
  index("asset_ledger_postings_account_created_idx").on(table.accountId, table.createdAt),
  check("asset_ledger_postings_nonzero_check", sql`${table.deltaBaseUnits} <> 0`)
]);

export const assetIdempotencyKeys = pgTable("asset_idempotency_keys", {
  id: uuid("id").primaryKey(),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  operation: varchar("operation", { length: 40 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  ledgerTransactionId: uuid("ledger_transaction_id").references(() => assetLedgerTransactions.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("asset_idempotency_owner_operation_key_uidx").on(table.canonicalUserId, table.operation, table.idempotencyKey)
]);


export const assetTransactionIntents = pgTable("asset_transaction_intents", {
  id: uuid("id").primaryKey(),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  assetId: uuid("asset_id").notNull().references(() => assetRegistry.id, { onDelete: "restrict" }),
  operation: varchar("operation", { length: 32 }).notNull(),
  amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
  fromAddress: varchar("from_address", { length: 44 }),
  toAddress: varchar("to_address", { length: 44 }),
  status: varchar("status", { length: 16 }).notNull().default("created"),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  chainSignature: varchar("chain_signature", { length: 128 }),
  recentBlockhash: varchar("recent_blockhash", { length: 44 }),
  lastValidBlockHeight: bigint("last_valid_block_height", { mode: "bigint" }),
  chainSlot: bigint("chain_slot", { mode: "bigint" }),
  chainCommitment: varchar("chain_commitment", { length: 16 }),
  lastStatusCheckAt: timestamp("last_status_check_at", { withTimezone: true }),
  ledgerPostedAt: timestamp("ledger_posted_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("asset_transaction_intents_owner_idempotency_uidx").on(table.canonicalUserId, table.idempotencyKey),
  uniqueIndex("asset_transaction_intents_chain_signature_uidx").on(table.chainSignature).where(sql`${table.chainSignature} IS NOT NULL`),
  index("asset_transaction_intents_status_created_idx").on(table.status, table.createdAt),
  index("asset_transaction_intents_user_created_idx").on(table.canonicalUserId, table.createdAt),
  check("asset_transaction_intents_amount_check", sql`${table.amountBaseUnits} > 0`),
  check("asset_transaction_intents_status_check", sql`${table.status} IN ('created', 'signed', 'submitted', 'confirmed', 'finalized', 'failed', 'expired')`),
  check("asset_transaction_intents_commitment_check", sql`${table.chainCommitment} IS NULL OR ${table.chainCommitment} IN ('processed', 'confirmed', 'finalized')`),
  check("asset_transaction_intents_finalized_evidence_check", sql`${table.status} <> 'finalized' OR (${table.chainSignature} IS NOT NULL AND ${table.chainSlot} IS NOT NULL AND ${table.chainCommitment} = 'finalized')`)
]);

export const assetTransactionTransitions = pgTable("asset_transaction_transitions", {
  id: uuid("id").primaryKey(),
  intentId: uuid("intent_id").notNull().references(() => assetTransactionIntents.id, { onDelete: "restrict" }),
  fromStatus: varchar("from_status", { length: 16 }),
  toStatus: varchar("to_status", { length: 16 }).notNull(),
  reason: varchar("reason", { length: 256 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("asset_transaction_transitions_intent_created_idx").on(table.intentId, table.createdAt),
  check("asset_transaction_transitions_to_status_check", sql.raw("to_status IN ('created', 'signed', 'submitted', 'confirmed', 'finalized', 'failed', 'expired')"))
]);


export const chainIndexerSources = pgTable("chain_indexer_sources", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assetRegistry.id, { onDelete: "restrict" }),
  network: varchar("network", { length: 24 }).notNull(),
  ownerAddress: varchar("owner_address", { length: 44 }).notNull(),
  tokenAccountAddress: varchar("token_account_address", { length: 44 }).notNull(),
  firstSeenSlot: bigint("first_seen_slot", { mode: "bigint" }).notNull(),
  openingBalanceBaseUnits: bigint("opening_balance_base_units", { mode: "bigint" }).notNull().default(0n),
  openingBalanceSlot: bigint("opening_balance_slot", { mode: "bigint" }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("chain_indexer_sources_network_token_account_uidx").on(table.network, table.tokenAccountAddress),
  index("chain_indexer_sources_asset_status_idx").on(table.assetId, table.status),
  check("chain_indexer_sources_network_check", sql.raw("network IN ('devnet', 'mainnet-beta')")),
  check("chain_indexer_sources_status_check", sql.raw("status IN ('active', 'closed', 'ignored')")),
  check("chain_indexer_sources_first_slot_check", sql.raw("first_seen_slot >= 0")),
  check("chain_indexer_sources_opening_balance_check", sql.raw("opening_balance_base_units >= 0 AND (opening_balance_slot IS NULL OR opening_balance_slot >= 0)"))
]);

export const chainIndexerCursors = pgTable("chain_indexer_cursors", {
  id: uuid("id").primaryKey(),
  network: varchar("network", { length: 24 }).notNull(),
  sourceKey: varchar("source_key", { length: 64 }).notNull().default("network"),
  lastFinalizedSlot: bigint("last_finalized_slot", { mode: "bigint" }).notNull().default(-1n),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("chain_indexer_cursors_network_source_uidx").on(table.network, table.sourceKey),
  check("chain_indexer_cursors_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`),
  check("chain_indexer_cursors_slot_check", sql`${table.lastFinalizedSlot} >= -1`)
]);

export const chainObservedEvents = pgTable("chain_observed_events", {
  id: uuid("id").primaryKey(),
  network: varchar("network", { length: 24 }).notNull(),
  signature: varchar("signature", { length: 128 }).notNull(),
  slot: bigint("slot", { mode: "bigint" }).notNull(),
  instructionIndex: integer("instruction_index").notNull(),
  eventIndex: integer("event_index").notNull(),
  programId: varchar("program_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  processingStatus: varchar("processing_status", { length: 16 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("chain_observed_events_identity_uidx").on(table.network, table.signature, table.instructionIndex, table.eventIndex),
  index("chain_observed_events_network_slot_idx").on(table.network, table.slot),
  index("chain_observed_events_status_created_idx").on(table.processingStatus, table.createdAt),
  check("chain_observed_events_status_check", sql`${table.processingStatus} IN ('observed', 'processed', 'ignored', 'quarantined')`)
]);

export const chainReconciliationDiscrepancies = pgTable("chain_reconciliation_discrepancies", {
  id: uuid("id").primaryKey(),
  network: varchar("network", { length: 24 }).notNull(),
  assetId: uuid("asset_id").references(() => assetRegistry.id, { onDelete: "restrict" }),
  transactionIntentId: uuid("transaction_intent_id").references(() => assetTransactionIntents.id, { onDelete: "restrict" }),
  discrepancyType: varchar("discrepancy_type", { length: 64 }).notNull(),
  expected: jsonb("expected").$type<Record<string, unknown>>().notNull().default({}),
  observed: jsonb("observed").$type<Record<string, unknown>>().notNull().default({}),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
}, (table) => [
  index("chain_reconciliation_status_created_idx").on(table.status, table.createdAt),
  index("chain_reconciliation_intent_idx").on(table.transactionIntentId),
  check("chain_reconciliation_status_check", sql`${table.status} IN ('open', 'investigating', 'resolved', 'ignored')`),
  check("chain_reconciliation_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`)
]);


export const bdAccounts = pgTable("bd_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "restrict" }),
  accountType: varchar("account_type", { length: 16 }).notNull(),
  balanceBaseUnits: bigint("balance_base_units", { mode: "bigint" }).notNull().default(0n),
  lifetimeEarnedBaseUnits: bigint("lifetime_earned_base_units", { mode: "bigint" }).notNull().default(0n),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("bd_accounts_user_id_uidx").on(table.userId).where(sql`${table.userId} IS NOT NULL`),
  index("bd_accounts_type_idx").on(table.accountType),
  check("bd_accounts_type_user_check", sql`(${table.accountType} = 'user' AND ${table.userId} IS NOT NULL) OR (${table.accountType} = 'system' AND ${table.userId} IS NULL)`),
  check("bd_accounts_lifetime_nonnegative_check", sql`${table.lifetimeEarnedBaseUnits} >= 0`)
]);

export const bdRewardRules = pgTable("bd_reward_rules", {
  id: text("id").primaryKey(),
  ruleKey: varchar("rule_key", { length: 64 }).notNull(),
  version: integer("version").notNull(),
  rewardBaseUnits: bigint("reward_base_units", { mode: "bigint" }).notNull(),
  budgetBaseUnits: bigint("budget_base_units", { mode: "bigint" }).notNull(),
  consumedBaseUnits: bigint("consumed_base_units", { mode: "bigint" }).notNull().default(0n),
  enabled: boolean("enabled").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("bd_reward_rules_key_version_unique").on(table.ruleKey, table.version),
  uniqueIndex("bd_reward_rules_one_enabled_uidx").on(table.ruleKey).where(sql`${table.enabled} = true`),
  index("bd_reward_rules_enabled_key_idx").on(table.ruleKey, table.enabled),
  check("bd_reward_rules_amount_check", sql`${table.rewardBaseUnits} > 0`),
  check("bd_reward_rules_budget_check", sql`${table.budgetBaseUnits} > 0`),
  check("bd_reward_rules_consumed_check", sql`${table.consumedBaseUnits} >= 0 AND ${table.consumedBaseUnits} <= ${table.budgetBaseUnits}`),
  check("bd_reward_rules_window_check", sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`)
]);

export const bdRewardEvents = pgTable("bd_reward_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  eventKey: varchar("event_key", { length: 240 }).notNull().unique(),
  ruleKey: varchar("rule_key", { length: 64 }).notNull(),
  ruleVersion: integer("rule_version").notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("bd_reward_events_user_created_idx").on(table.userId, table.createdAt),
  check("bd_reward_events_amount_check", sql`${table.amountBaseUnits} > 0`),
  check("bd_reward_events_status_check", sql`${table.status} = 'credited'`)
]);

export const bdLedgerTransactions = pgTable("bd_ledger_transactions", {
  id: text("id").primaryKey(),
  transactionType: varchar("transaction_type", { length: 40 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 240 }).notNull().unique(),
  referenceType: varchar("reference_type", { length: 64 }).notNull(),
  referenceId: text("reference_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const bdLedgerEntries = pgTable("bd_ledger_entries", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => bdLedgerTransactions.id, { onDelete: "restrict" }),
  accountId: text("account_id").notNull().references(() => bdAccounts.id, { onDelete: "restrict" }),
  deltaBaseUnits: bigint("delta_base_units", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("bd_ledger_entries_transaction_idx").on(table.transactionId),
  index("bd_ledger_entries_account_created_idx").on(table.accountId, table.createdAt),
  check("bd_ledger_entries_nonzero_check", sql`${table.deltaBaseUnits} <> 0`)
]);



/** V1 community foundation: catalogues and attribution only; no reward grants. */
export const communityTasks = pgTable("community_tasks", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 120 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull().default(""),
  category: varchar("category", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("community_tasks_status_category_idx").on(table.status, table.category),
  check("community_tasks_status_check", sql`${table.status} IN ('draft', 'published', 'paused', 'archived')`),
  check("community_tasks_window_check", sql`${table.endsAt} IS NULL OR ${table.startsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`)
]);

export const invitationCodes = pgTable("invitation_codes", {
  id: uuid("id").primaryKey(),
  inviterUserId: text("inviter_user_id").notNull().references(() => user.id, { onDelete: "restrict" }).unique(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("invitation_codes_status_check", sql`${table.status} IN ('active', 'disabled')`)
]);

export const invitationAttributions = pgTable("invitation_attributions", {
  id: uuid("id").primaryKey(),
  inviterUserId: text("inviter_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  inviteeUserId: text("invitee_user_id").notNull().references(() => user.id, { onDelete: "restrict" }).unique(),
  invitationCodeId: uuid("invitation_code_id").notNull().references(() => invitationCodes.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 16 }).notNull().default("attributed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("invitation_attributions_inviter_created_idx").on(table.inviterUserId, table.createdAt),
  check("invitation_attributions_status_check", sql`${table.status} IN ('attributed', 'review', 'rejected')`),
  check("invitation_attributions_no_self_check", sql`${table.inviterUserId} <> ${table.inviteeUserId}`)
]);

export const communityAnnouncements = pgTable("community_announcements", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull().default(""),
  body: text("body").notNull(),
  locale: varchar("locale", { length: 16 }).notNull().default("en-US"),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("community_announcements_status_published_idx").on(table.status, table.publishedAt),
  check("community_announcements_status_check", sql`${table.status} IN ('draft', 'published', 'archived')`)
]);

export const communityEvents = pgTable("community_events", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull().default(""),
  body: text("body").notNull().default(""),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("community_events_status_start_idx").on(table.status, table.startsAt),
  check("community_events_status_check", sql`${table.status} IN ('draft', 'published', 'cancelled', 'completed')`),
  check("community_events_window_check", sql`${table.endsAt} IS NULL OR ${table.startsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`)
]);

/** V1.1 BG rewards: policy and payout records only; no signer secrets are stored here. */
export const rewardPrograms = pgTable("reward_programs", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assetRegistry.id, { onDelete: "restrict" }),
  programKey: varchar("program_key", { length: 64 }).notNull(),
  actionType: varchar("action_type", { length: 32 }).notNull(),
  ruleVersion: integer("rule_version").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  rewardBaseUnits: bigint("reward_base_units", { mode: "bigint" }).notNull(),
  perUserLimit: integer("per_user_limit").notNull().default(1),
  budgetBaseUnits: bigint("budget_base_units", { mode: "bigint" }).notNull(),
  reservedBaseUnits: bigint("reserved_base_units", { mode: "bigint" }).notNull().default(0n),
  paidBaseUnits: bigint("paid_base_units", { mode: "bigint" }).notNull().default(0n),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  approvalReference: varchar("approval_reference", { length: 128 }),
  approvedBy: varchar("approved_by", { length: 128 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("reward_programs_key_version_uidx").on(table.assetId, table.programKey, table.ruleVersion),
  uniqueIndex("reward_programs_one_active_key_uidx").on(table.assetId, table.programKey).where(sql`${table.status} = 'active'`),
  index("reward_programs_asset_status_idx").on(table.assetId, table.status),
  check("reward_programs_action_check", sql`${table.actionType} IN ('daily_collection', 'task_completion', 'invitation', 'campaign')`),
  check("reward_programs_status_check", sql`${table.status} IN ('draft', 'active', 'paused', 'retired')`),
  check("reward_programs_active_approval_check", sql`${table.status} <> 'active' OR (${table.approvalReference} IS NOT NULL AND length(trim(${table.approvalReference})) > 0 AND ${table.approvedBy} IS NOT NULL AND length(trim(${table.approvedBy})) > 0 AND ${table.approvedAt} IS NOT NULL)`),
  check("reward_programs_version_limit_check", sql`${table.ruleVersion} > 0 AND ${table.perUserLimit} > 0`),
  check("reward_programs_amount_check", sql`${table.rewardBaseUnits} > 0 AND ${table.budgetBaseUnits} > 0`),
  check("reward_programs_budget_usage_check", sql`${table.reservedBaseUnits} >= 0 AND ${table.paidBaseUnits} >= 0 AND ${table.reservedBaseUnits} + ${table.paidBaseUnits} <= ${table.budgetBaseUnits}`),
  check("reward_programs_window_check", sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`)
]);

export const rewardEvents = pgTable("reward_events", {
  id: uuid("id").primaryKey(),
  programId: uuid("program_id").notNull().references(() => rewardPrograms.id, { onDelete: "restrict" }),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  actionType: varchar("action_type", { length: 32 }).notNull(),
  evidenceRef: varchar("evidence_ref", { length: 256 }),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull().unique(),
  amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
  ruleVersion: integer("rule_version").notNull(),
  periodKey: date("period_key", { mode: "string" }),
  status: varchar("status", { length: 32 }).notNull().default("reserved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("reward_events_daily_user_period_uidx").on(table.canonicalUserId, table.periodKey).where(sql`${table.actionType} = 'daily_collection' AND ${table.periodKey} IS NOT NULL`),
  index("reward_events_user_created_idx").on(table.canonicalUserId, table.createdAt),
  index("reward_events_program_status_idx").on(table.programId, table.status),
  check("reward_events_action_check", sql`${table.actionType} IN ('daily_collection', 'task_completion', 'invitation', 'campaign')`),
  check("reward_events_status_check", sql`${table.status} IN ('reserved', 'submitted', 'confirmed', 'finalized', 'paid', 'reconciliation_required', 'rejected', 'failed', 'expired', 'quarantined', 'cancelled')`),
  check("reward_events_amount_check", sql`${table.amountBaseUnits} > 0`),
  check("reward_events_rule_version_check", sql`${table.ruleVersion} > 0`),
  check("reward_events_daily_period_check", sql`${table.actionType} <> 'daily_collection' OR ${table.periodKey} IS NOT NULL`)
]);

export const rewardPayoutIntents = pgTable("reward_payout_intents", {
  id: uuid("id").primaryKey(),
  rewardEventId: uuid("reward_event_id").notNull().references(() => rewardEvents.id, { onDelete: "restrict" }).unique(),
  treasuryAccountId: uuid("treasury_account_id").notNull().references(() => treasuryAccounts.id, { onDelete: "restrict" }),
  network: varchar("network", { length: 24 }).notNull(),
  mintAddress: varchar("mint_address", { length: 44 }).notNull(),
  tokenProgram: varchar("token_program", { length: 64 }).notNull(),
  sourceTokenAccount: varchar("source_token_account", { length: 44 }).notNull(),
  feePayerAddress: varchar("fee_payer_address", { length: 44 }).notNull(),
  treasuryAuthorityAddress: varchar("treasury_authority_address", { length: 44 }).notNull(),
  destinationWallet: varchar("destination_wallet", { length: 44 }).notNull(),
  destinationTokenAccount: varchar("destination_token_account", { length: 44 }).notNull(),
  amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  chainSignature: varchar("chain_signature", { length: 128 }),
  chainSlot: bigint("chain_slot", { mode: "bigint" }),
  recentBlockhash: varchar("recent_blockhash", { length: 44 }),
  lastValidBlockHeight: bigint("last_valid_block_height", { mode: "bigint" }),
  confirmedSlot: bigint("confirmed_slot", { mode: "bigint" }),
  finalizedSlot: bigint("finalized_slot", { mode: "bigint" }),
  reconciliationMetadata: jsonb("reconciliation_metadata").$type<Record<string, unknown>>().notNull().default({}),
  lastErrorCode: varchar("last_error_code", { length: 64 }),
  retryAfter: timestamp("retry_after", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("reward_payout_intents_signature_uidx").on(table.chainSignature).where(sql`${table.chainSignature} IS NOT NULL`),
  index("reward_payout_intents_status_created_idx").on(table.status, table.createdAt),
  index("reward_payout_intents_treasury_idx").on(table.treasuryAccountId, table.createdAt),
  index("reward_payout_intents_reconciliation_due_idx").on(table.retryAfter, table.createdAt).where(sql`${table.network} = 'devnet' AND ${table.status} IN ('signed', 'submitted', 'confirmed', 'finalized', 'reconciliation_required')`),
  check("reward_payout_intents_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`),
  check("reward_payout_intents_status_check", sql`${table.status} IN ('queued', 'signing', 'signed', 'submitted', 'confirmed', 'finalized', 'paid', 'reconciliation_required', 'failed', 'expired', 'quarantined', 'cancelled')`),
  check("reward_payout_intents_amount_check", sql`${table.amountBaseUnits} > 0`),
  check("reward_payout_intents_signer_roles_check", sql`${table.feePayerAddress} <> ${table.treasuryAuthorityAddress} AND ${table.feePayerAddress} <> ${table.destinationWallet} AND ${table.treasuryAuthorityAddress} <> ${table.destinationWallet}`),
  check("reward_payout_intents_token_program_check", sql`${table.tokenProgram} = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'`),
  check("reward_payout_intents_last_valid_height_check", sql`${table.lastValidBlockHeight} IS NULL OR ${table.lastValidBlockHeight} >= 0`),
  check("reward_payout_intents_confirmed_slot_check", sql`${table.confirmedSlot} IS NULL OR ${table.confirmedSlot} >= 0`),
  check("reward_payout_intents_finalized_slot_check", sql`${table.finalizedSlot} IS NULL OR ${table.finalizedSlot} >= 0`),
  check("reward_payout_intents_slot_order_check", sql`${table.confirmedSlot} IS NULL OR ${table.finalizedSlot} IS NULL OR ${table.finalizedSlot} >= ${table.confirmedSlot}`),
  check("reward_payout_intents_confirmed_evidence_check", sql`${table.status} <> 'confirmed' OR (${table.chainSignature} IS NOT NULL AND ${table.confirmedSlot} IS NOT NULL)`),
  check("reward_payout_intents_signed_blockhash_check", sql`${table.status} NOT IN ('signed', 'submitted', 'confirmed', 'finalized', 'paid') OR (${table.recentBlockhash} IS NOT NULL AND ${table.lastValidBlockHeight} IS NOT NULL)`),
  check("reward_payout_intents_reconciliation_signature_check", sql`${table.status} NOT IN ('signed', 'submitted', 'confirmed', 'finalized', 'paid', 'reconciliation_required') OR (${table.chainSignature} IS NOT NULL AND ${table.recentBlockhash} IS NOT NULL AND ${table.lastValidBlockHeight} IS NOT NULL)`),
  check("reward_payout_intents_finalized_check", sql`${table.status} NOT IN ('finalized', 'paid') OR (${table.chainSignature} IS NOT NULL AND ${table.chainSlot} IS NOT NULL AND ${table.finalizedAt} IS NOT NULL AND ${table.finalizedSlot} IS NOT NULL)`)
]);

export const treasuryAccounts = pgTable("treasury_accounts", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assetRegistry.id, { onDelete: "restrict" }),
  network: varchar("network", { length: 24 }).notNull(),
  mintAddress: varchar("mint_address", { length: 44 }),
  treasuryWalletAddress: varchar("treasury_wallet_address", { length: 44 }),
  tokenAccountAddress: varchar("token_account_address", { length: 44 }),
  feePayerAddress: varchar("fee_payer_address", { length: 44 }),
  signerProvider: varchar("signer_provider", { length: 32 }).notNull().default("unconfigured"),
  signerKeyReference: varchar("signer_key_reference", { length: 256 }),
  hotWalletCapBaseUnits: bigint("hot_wallet_cap_base_units", { mode: "bigint" }).notNull().default(0n),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("treasury_accounts_asset_network_uidx").on(table.assetId, table.network),
  check("treasury_accounts_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`),
  check("treasury_accounts_signer_provider_check", sql`${table.signerProvider} IN ('unconfigured', 'devnet_local', 'kms', 'hsm', 'external')`),
  check("treasury_accounts_status_check", sql`${table.status} IN ('draft', 'active', 'paused', 'retired')`),
  check("treasury_accounts_cap_check", sql`${table.hotWalletCapBaseUnits} >= 0`),
  check("treasury_accounts_active_config_check", sql`${table.status} <> 'active' OR (${table.mintAddress} IS NOT NULL AND ${table.tokenAccountAddress} IS NOT NULL AND ${table.signerProvider} <> 'unconfigured')`)
]);

export const bgTreasuryReconciliationSnapshots = pgTable("bg_treasury_reconciliation_snapshots", {
  id: uuid("id").primaryKey(),
  treasuryAccountId: uuid("treasury_account_id").notNull().references(() => treasuryAccounts.id, { onDelete: "restrict" }),
  network: varchar("network", { length: 24 }).notNull(),
  mintAddress: varchar("mint_address", { length: 44 }).notNull(),
  tokenProgram: varchar("token_program", { length: 64 }).notNull(),
  tokenAccountAddress: varchar("token_account_address", { length: 44 }).notNull(),
  accountOwnerAddress: varchar("account_owner_address", { length: 44 }),
  accountMintAddress: varchar("account_mint_address", { length: 44 }),
  accountState: varchar("account_state", { length: 16 }),
  observedSlot: bigint("observed_slot", { mode: "bigint" }),
  tokenBalanceBaseUnits: bigint("token_balance_base_units", { mode: "bigint" }),
  reservedBaseUnits: bigint("reserved_base_units", { mode: "bigint" }).notNull(),
  paidBaseUnits: bigint("paid_base_units", { mode: "bigint" }).notNull(),
  availableAfterReservationsBaseUnits: bigint("available_after_reservations_base_units", { mode: "bigint" }),
  status: varchar("status", { length: 24 }).notNull(),
  discrepancyCode: varchar("discrepancy_code", { length: 64 }),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("bg_treasury_reconciliation_treasury_created_idx").on(table.treasuryAccountId, table.createdAt),
  index("bg_treasury_reconciliation_status_created_idx").on(table.status, table.createdAt),
  check("bg_treasury_reconciliation_network_check", sql`${table.network} IN ('devnet', 'mainnet-beta')`),
  check("bg_treasury_reconciliation_status_check", sql`${table.status} IN ('matched', 'insufficient_inventory', 'quarantined', 'unavailable')`),
  check("bg_treasury_reconciliation_account_state_check", sql`${table.accountState} IS NULL OR ${table.accountState} IN ('uninitialized', 'initialized', 'frozen')`),
  check("bg_treasury_reconciliation_amounts_check", sql`${table.reservedBaseUnits} >= 0 AND ${table.paidBaseUnits} >= 0 AND (${table.tokenBalanceBaseUnits} IS NULL OR ${table.tokenBalanceBaseUnits} >= 0)`),
  check("bg_treasury_reconciliation_available_check", sql`${table.availableAfterReservationsBaseUnits} IS NULL OR ${table.availableAfterReservationsBaseUnits} = ${table.tokenBalanceBaseUnits} - ${table.reservedBaseUnits}`),
  check("bg_treasury_reconciliation_matched_check", sql`${table.status} <> 'matched' OR (${table.tokenBalanceBaseUnits} IS NOT NULL AND ${table.availableAfterReservationsBaseUnits} IS NOT NULL AND ${table.availableAfterReservationsBaseUnits} >= 0 AND ${table.accountState} = 'initialized' AND ${table.accountOwnerAddress} IS NOT NULL AND ${table.accountMintAddress} = ${table.mintAddress})`)
]);

export const rewardAuditEvents = pgTable("reward_audit_events", {
  id: uuid("id").primaryKey(),
  actorType: varchar("actor_type", { length: 24 }).notNull(),
  actorId: varchar("actor_id", { length: 128 }),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 64 }).notNull(),
  targetId: varchar("target_id", { length: 128 }),
  reason: varchar("reason", { length: 500 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("reward_audit_events_target_created_idx").on(table.targetType, table.targetId, table.createdAt),
  check("reward_audit_events_actor_check", sql`${table.actorType} IN ('system', 'operator', 'service')`)
]);


/** Immutable server-verified evidence and human review records for BG task rewards. */
export const bgTaskEvidenceRecords = pgTable("bg_task_evidence_records", {
  id: uuid("id").primaryKey(),
  canonicalUserId: uuid("canonical_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  taskId: varchar("task_id", { length: 64 }).notNull(),
  taskVersion: integer("task_version").notNull(),
  verifierKey: varchar("verifier_key", { length: 64 }).notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  issuer: varchar("issuer", { length: 32 }).notNull(),
  sourceEvidenceId: varchar("source_evidence_id", { length: 128 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  digestSha256: varchar("digest_sha256", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending_review"),
  consumedRewardEventId: uuid("consumed_reward_event_id").references(() => rewardEvents.id, { onDelete: "restrict" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("bg_task_evidence_idempotency_uidx").on(table.idempotencyKey),
  uniqueIndex("bg_task_evidence_source_replay_uidx").on(table.issuer, table.source, table.sourceEvidenceId),
  uniqueIndex("bg_task_evidence_consumed_reward_uidx").on(table.consumedRewardEventId).where(sql`${table.consumedRewardEventId} IS NOT NULL`),
  index("bg_task_evidence_user_task_status_idx").on(table.canonicalUserId, table.taskId, table.status, table.submittedAt),
  check("bg_task_evidence_task_version_check", sql`${table.taskVersion} > 0`),
  check("bg_task_evidence_issuer_check", sql`${table.issuer} IN ('brightglobe-server', 'trusted-provider')`),
  check("bg_task_evidence_digest_check", sql.raw("digest_sha256 ~ '^[a-f0-9]{64}$'")),
  check("bg_task_evidence_status_check", sql`${table.status} IN ('pending_review', 'approved', 'rejected', 'appealed', 'consumed')`),
  check("bg_task_evidence_consumed_check", sql`(${table.status} = 'consumed' AND ${table.consumedRewardEventId} IS NOT NULL) OR (${table.status} <> 'consumed' AND ${table.consumedRewardEventId} IS NULL)`)
]);

export const bgTaskAppeals = pgTable("bg_task_appeals", {
  id: uuid("id").primaryKey(),
  evidenceId: uuid("evidence_id").notNull().references(() => bgTaskEvidenceRecords.id, { onDelete: "restrict" }).unique(),
  appellantUserId: uuid("appellant_user_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  reason: varchar("reason", { length: 2000 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => canonicalUsers.id, { onDelete: "restrict" }),
  resolutionReason: varchar("resolution_reason", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
}, (table) => [
  index("bg_task_appeals_status_created_idx").on(table.status, table.createdAt),
  check("bg_task_appeals_reason_check", sql`length(trim(${table.reason})) > 0`),
  check("bg_task_appeals_status_check", sql`${table.status} IN ('open', 'resolved')`),
  check("bg_task_appeals_resolution_check", sql`(${table.status} = 'open' AND ${table.resolvedBy} IS NULL AND ${table.resolvedAt} IS NULL) OR (${table.status} = 'resolved' AND ${table.resolvedBy} IS NOT NULL AND ${table.resolvedAt} IS NOT NULL AND ${table.resolutionReason} IS NOT NULL)`)
]);

export const bgTaskReviewDecisions = pgTable("bg_task_review_decisions", {
  id: uuid("id").primaryKey(),
  evidenceId: uuid("evidence_id").notNull().references(() => bgTaskEvidenceRecords.id, { onDelete: "restrict" }),
  decisionType: varchar("decision_type", { length: 16 }).notNull(),
  decision: varchar("decision", { length: 16 }).notNull(),
  reviewerId: uuid("reviewer_id").notNull().references(() => canonicalUsers.id, { onDelete: "restrict" }),
  reason: varchar("reason", { length: 1000 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("bg_task_review_decisions_once_uidx").on(table.evidenceId, table.decisionType),
  index("bg_task_review_decisions_reviewer_created_idx").on(table.reviewerId, table.createdAt),
  check("bg_task_review_decision_type_check", sql`${table.decisionType} IN ('initial', 'appeal')`),
  check("bg_task_review_decision_check", sql`${table.decision} IN ('approved', 'rejected')`),
  check("bg_task_review_reason_check", sql`length(trim(${table.reason})) > 0`)
]);

export const bgTaskAuditEvents = pgTable("bg_task_audit_events", {
  id: uuid("id").primaryKey(),
  evidenceId: uuid("evidence_id").notNull().references(() => bgTaskEvidenceRecords.id, { onDelete: "restrict" }),
  actorType: varchar("actor_type", { length: 16 }).notNull(),
  actorId: varchar("actor_id", { length: 128 }),
  action: varchar("action", { length: 64 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("bg_task_audit_evidence_created_idx").on(table.evidenceId, table.createdAt),
  check("bg_task_audit_actor_check", sql`${table.actorType} IN ('service', 'user', 'operator')`)
]);


/** Server-managed staff identity and permission model; member identities never imply staff access. */
export const staffPrincipals = pgTable("staff_principals", {
  id: uuid("id").primaryKey(),
  authUserId: text("auth_user_id").notNull().references(() => user.id, { onDelete: "restrict" }).unique(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  displayLabel: varchar("display_label", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("staff_principals_status_check", sql`${table.status} IN ('pending', 'active', 'suspended', 'revoked')`),
  check("staff_principals_display_label_check", sql`length(trim(${table.displayLabel})) BETWEEN 1 AND 120`)
]);

export const staffRoles = pgTable("staff_roles", {
  id: uuid("id").primaryKey(),
  roleKey: varchar("role_key", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  description: varchar("description", { length: 500 }).notNull().default(""),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("staff_roles_status_check", sql`${table.status} IN ('active', 'disabled')`),
  check("staff_roles_key_check", sql.raw("role_key ~ '^[a-z][a-z0-9_.-]{1,63}$'"))
]);

export const staffPermissions = pgTable("staff_permissions", {
  id: uuid("id").primaryKey(),
  permissionKey: varchar("permission_key", { length: 96 }).notNull().unique(),
  description: varchar("description", { length: 500 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("staff_permissions_key_check", sql.raw("permission_key ~ '^[a-z][a-z0-9_.-]{1,95}$'"))
]);

export const staffRolePermissions = pgTable("staff_role_permissions", {
  roleId: uuid("role_id").notNull().references(() => staffRoles.id, { onDelete: "restrict" }),
  permissionId: uuid("permission_id").notNull().references(() => staffPermissions.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] })
]);

export const staffRoleAssignments = pgTable("staff_role_assignments", {
  id: uuid("id").primaryKey(),
  staffPrincipalId: uuid("staff_principal_id").notNull().references(() => staffPrincipals.id, { onDelete: "restrict" }),
  roleId: uuid("role_id").notNull().references(() => staffRoles.id, { onDelete: "restrict" }),
  grantedByStaffId: uuid("granted_by_staff_id").references(() => staffPrincipals.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("staff_role_assignments_principal_status_idx").on(table.staffPrincipalId, table.status, table.validFrom, table.validUntil),
  uniqueIndex("staff_role_assignments_active_uidx").on(table.staffPrincipalId, table.roleId).where(sql.raw("status = 'active'")),
  check("staff_role_assignments_status_check", sql`${table.status} IN ('active', 'revoked')`),
  check("staff_role_assignments_validity_check", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.validFrom}`),
  check("staff_role_assignments_revoked_check", sql`(${table.status} = 'active' AND ${table.revokedAt} IS NULL) OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL)`)
]);

export const staffAuditEvents = pgTable("staff_audit_events", {
  id: uuid("id").primaryKey(),
  actorStaffId: uuid("actor_staff_id").references(() => staffPrincipals.id, { onDelete: "restrict" }),
  subjectStaffId: uuid("subject_staff_id").references(() => staffPrincipals.id, { onDelete: "restrict" }),
  action: varchar("action", { length: 96 }).notNull(),
  reason: varchar("reason", { length: 1000 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  requestId: varchar("request_id", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("staff_audit_events_actor_created_idx").on(table.actorStaffId, table.createdAt),
  index("staff_audit_events_subject_created_idx").on(table.subjectStaffId, table.createdAt),
  check("staff_audit_events_reason_check", sql`length(trim(${table.reason})) BETWEEN 1 AND 1000`)
]);

export const staffStepUpGrants = pgTable("staff_step_up_grants", {
  id: uuid("id").primaryKey(),
  staffPrincipalId: uuid("staff_principal_id").notNull().references(() => staffPrincipals.id, { onDelete: "restrict" }),
  authUserId: text("auth_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  sessionId: text("session_id").notNull(),
  operation: varchar("operation", { length: 96 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true })
}, (table) => [
  index("staff_step_up_grants_subject_operation_idx").on(table.staffPrincipalId, table.sessionId, table.operation, table.expiresAt).where(sql`${table.consumedAt} IS NULL`),
  check("staff_step_up_operation_check", sql`${table.operation} IN ('bg.treasury.recovery.propose', 'bg.treasury.recovery.approve')`),
  check("staff_step_up_token_hash_check", sql.raw("token_hash ~ '^[a-f0-9]{64}$'")),
  check("staff_step_up_expiry_check", sql`${table.expiresAt} > ${table.issuedAt}`),
  check("staff_step_up_consumed_check", sql`${table.consumedAt} IS NULL OR ${table.consumedAt} >= ${table.issuedAt}`)
]);

export const schema = { staffPrincipals, staffRoles, staffPermissions, staffRolePermissions, staffRoleAssignments, staffAuditEvents, staffStepUpGrants, twoFactor, rewardPrograms, rewardEvents, rewardPayoutIntents, treasuryAccounts, rewardAuditEvents, bgTaskEvidenceRecords, bgTaskAppeals, bgTaskReviewDecisions, bgTaskAuditEvents, communityTasks, invitationCodes, invitationAttributions, communityAnnouncements, communityEvents, user, session, account, verification, userProfile, canonicalUsers, providerIdentities, walletOwnerships, identityAuditEvents, canonicalUserProfiles, walletChallenges, walletSessions, assetRegistry, assetAccounts, assetLedgerTransactions, assetLedgerPostings, assetIdempotencyKeys, assetTransactionIntents, assetTransactionTransitions, chainIndexerSources, chainIndexerCursors, chainObservedEvents, chainReconciliationDiscrepancies, bdAccounts, bdRewardRules, bdRewardEvents, bdLedgerTransactions, bdLedgerEntries };
