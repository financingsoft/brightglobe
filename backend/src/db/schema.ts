import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

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


export const bdAccounts = pgTable("bd_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "restrict" }),
  accountType: varchar("account_type", { length: 16 }).notNull(),
  balanceBaseUnits: bigint("balance_base_units", { mode: "bigint" }).notNull().default(0n),
  lifetimeEarnedBaseUnits: bigint("lifetime_earned_base_units", { mode: "bigint" }).notNull().default(0n),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("bd_accounts_user_id_uidx").on(table.userId),
  index("bd_accounts_type_idx").on(table.accountType)
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
  index("bd_reward_rules_enabled_key_idx").on(table.ruleKey, table.enabled)
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
  index("bd_reward_events_user_created_idx").on(table.userId, table.createdAt)
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
  index("bd_ledger_entries_account_created_idx").on(table.accountId, table.createdAt)
]);

export const schema = { user, session, account, verification, userProfile, bdAccounts, bdRewardRules, bdRewardEvents, bdLedgerTransactions, bdLedgerEntries };
