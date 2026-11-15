import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
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
  check("canonical_user_profiles_country_check", sql.raw("country_code IS NULL OR country_code ~ '^[A-Z]{2} = pgTable("wallet_challenges", {
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
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("chain_indexer_sources_network_token_account_uidx").on(table.network, table.tokenAccountAddress),
  index("chain_indexer_sources_asset_status_idx").on(table.assetId, table.status),
  check("chain_indexer_sources_network_check", sql.raw("network IN ('devnet', 'mainnet-beta')")),
  check("chain_indexer_sources_status_check", sql.raw("status IN ('active', 'closed', 'ignored')")),
  check("chain_indexer_sources_first_slot_check", sql.raw("first_seen_slot >= 0"))
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

export const schema = { user, session, account, verification, userProfile, canonicalUsers, providerIdentities, walletOwnerships, identityAuditEvents, canonicalUserProfiles, walletChallenges, walletSessions, assetRegistry, assetAccounts, assetLedgerTransactions, assetLedgerPostings, assetIdempotencyKeys, assetTransactionIntents, assetTransactionTransitions, chainIndexerSources, chainIndexerCursors, chainObservedEvents, chainReconciliationDiscrepancies, bdAccounts, bdRewardRules, bdRewardEvents, bdLedgerTransactions, bdLedgerEntries };
"))
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
  chainSlot: bigint("chain_slot", { mode: "bigint" }),
  chainCommitment: varchar("chain_commitment", { length: 16 }),
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


export const chainIndexerCursors = pgTable("chain_indexer_cursors", {
  id: uuid("id").primaryKey(),
  network: varchar("network", { length: 24 }).notNull(),
  lastFinalizedSlot: bigint("last_finalized_slot", { mode: "bigint" }).notNull().default(-1n),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("chain_indexer_cursors_network_uidx").on(table.network),
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

export const schema = { user, session, account, verification, userProfile, canonicalUsers, providerIdentities, walletOwnerships, identityAuditEvents, walletChallenges, walletSessions, assetRegistry, assetAccounts, assetLedgerTransactions, assetLedgerPostings, assetIdempotencyKeys, assetTransactionIntents, assetTransactionTransitions, chainIndexerCursors, chainObservedEvents, chainReconciliationDiscrepancies, bdAccounts, bdRewardRules, bdRewardEvents, bdLedgerTransactions, bdLedgerEntries };
