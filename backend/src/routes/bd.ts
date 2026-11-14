import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client.js";
import type { BetterAuthInstance } from "../auth.js";
import {
  bdAccounts,
  bdLedgerEntries,
  bdLedgerTransactions,
  bdRewardEvents,
  bdRewardRules
} from "../db/schema.js";
import { getDailyCollectionEventKey, getUtcPeriodKey } from "../domain/bd.js";
import { createRequireAuth, type AuthVariables } from "../middleware/require-auth.js";

const DAILY_RULE_KEY = "daily-collection";
const DAILY_EXPENSE_ACCOUNT_ID = "system:daily-collection-expense";

export function createBdRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono<{ Variables: AuthVariables }>();

class DailyCollectionError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DailyCollectionError";
  }
}

function isRuleInWindow(rule: typeof bdRewardRules.$inferSelect, now: Date): boolean {
  return rule.startsAt <= now && (rule.endsAt === null || rule.endsAt > now);
}

function hasBudget(rule: typeof bdRewardRules.$inferSelect): boolean {
  return rule.consumedBaseUnits + rule.rewardBaseUnits <= rule.budgetBaseUnits;
}

async function getAccountSnapshot(userId: string, now: Date) {
  const periodKey = getUtcPeriodKey(now);
  const eventKey = getDailyCollectionEventKey(userId, periodKey);
  const [account] = await db.select().from(bdAccounts)
    .where(eq(bdAccounts.userId, userId))
    .limit(1);
  const [event] = await db.select({
    amountBaseUnits: bdRewardEvents.amountBaseUnits
  }).from(bdRewardEvents)
    .where(eq(bdRewardEvents.eventKey, eventKey))
    .limit(1);
  const [rule] = await db.select().from(bdRewardRules)
    .where(and(
      eq(bdRewardRules.ruleKey, DAILY_RULE_KEY),
      eq(bdRewardRules.enabled, true)
    ))
    .orderBy(desc(bdRewardRules.version))
    .limit(1);

  const validRule = rule && isRuleInWindow(rule, now) ? rule : null;
  const available = Boolean(validRule && hasBudget(validRule) && !event);
  const status = event
    ? "claimed"
    : !rule
      ? "not_configured"
      : available
        ? "available"
        : "unavailable";

  return {
    account: {
      assetCode: "BD",
      availableBaseUnits: account?.balanceBaseUnits.toString() ?? "0",
      pendingBaseUnits: "0",
      lifetimeEarnedBaseUnits: account?.lifetimeEarnedBaseUnits.toString() ?? "0"
    },
    dailyCollection: {
      periodKey,
      status,
      canClaim: available,
      claimed: Boolean(event),
      rewardBaseUnits: event
        ? event.amountBaseUnits.toString()
        : validRule
          ? validRule.rewardBaseUnits.toString()
          : null
    }
  };
}

routes.use("*", createRequireAuth(auth));

routes.get("/", async (context) => {
  const current = context.get("authSession");
  return context.json(await getAccountSnapshot(current.user.id, new Date()));
});

routes.get("/history", async (context) => {
  const current = context.get("authSession");
  const [account] = await db.select({ id: bdAccounts.id }).from(bdAccounts)
    .where(eq(bdAccounts.userId, current.user.id))
    .limit(1);

  if (!account) return context.json({ items: [] });

  const rows = await db.select({
    id: bdLedgerEntries.id,
    transactionId: bdLedgerTransactions.id,
    transactionType: bdLedgerTransactions.transactionType,
    deltaBaseUnits: bdLedgerEntries.deltaBaseUnits,
    createdAt: bdLedgerTransactions.createdAt
  }).from(bdLedgerEntries)
    .innerJoin(bdLedgerTransactions, eq(bdLedgerEntries.transactionId, bdLedgerTransactions.id))
    .where(eq(bdLedgerEntries.accountId, account.id))
    .orderBy(desc(bdLedgerTransactions.createdAt))
    .limit(50);

  return context.json({
    items: rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      type: row.transactionType,
      deltaBaseUnits: row.deltaBaseUnits.toString(),
      createdAt: row.createdAt.toISOString()
    }))
  });
});

routes.post("/daily-collection", async (context) => {
  const current = context.get("authSession");
  const now = new Date();
  const periodKey = getUtcPeriodKey(now);
  const eventKey = getDailyCollectionEventKey(current.user.id, periodKey);

  try {
    const credited = await db.transaction(async (transaction) => {
      const [rule] = await transaction.select().from(bdRewardRules)
        .where(and(
          eq(bdRewardRules.ruleKey, DAILY_RULE_KEY),
          eq(bdRewardRules.enabled, true),
        ))
        .orderBy(desc(bdRewardRules.version))
        .limit(1)
        .for("update");

      if (!rule) {
        throw new DailyCollectionError(
          "DAILY_COLLECTION_NOT_CONFIGURED",
          "Daily collection is not configured yet."
        );
      }
      if (!isRuleInWindow(rule, now)) {
        throw new DailyCollectionError(
          "DAILY_COLLECTION_UNAVAILABLE",
          "Daily collection is not available at this time."
        );
      }
      const [existing] = await transaction.select({ id: bdRewardEvents.id })
        .from(bdRewardEvents)
        .where(eq(bdRewardEvents.eventKey, eventKey))
        .limit(1);
      if (existing) {
        throw new DailyCollectionError(
          "ALREADY_COLLECTED",
          "Today's Black Diamond has already been collected."
        );
      }

      if (!hasBudget(rule)) {
        throw new DailyCollectionError(
          "DAILY_BUDGET_EXHAUSTED",
          "The approved daily collection budget has been used."
        );
      }

      await transaction.insert(bdAccounts).values({
        id: `user:${current.user.id}`,
        userId: current.user.id,
        accountType: "user",
        balanceBaseUnits: 0n,
        lifetimeEarnedBaseUnits: 0n
      }).onConflictDoNothing();

      await transaction.insert(bdAccounts).values({
        id: DAILY_EXPENSE_ACCOUNT_ID,
        userId: null,
        accountType: "system",
        balanceBaseUnits: 0n,
        lifetimeEarnedBaseUnits: 0n
      }).onConflictDoNothing();

      const [userAccount] = await transaction.select().from(bdAccounts)
        .where(eq(bdAccounts.userId, current.user.id))
        .limit(1)
        .for("update");
      if (!userAccount) throw new Error("Unable to initialize the BD account.");

      const [expenseAccount] = await transaction.select().from(bdAccounts)
        .where(eq(bdAccounts.id, DAILY_EXPENSE_ACCOUNT_ID))
        .limit(1)
        .for("update");
      if (!expenseAccount) throw new Error("Unable to initialize the reward expense account.");

      const eventId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
      const entryUserId = crypto.randomUUID();
      const entryExpenseId = crypto.randomUUID();
      const amount = rule.rewardBaseUnits;

      await transaction.insert(bdRewardEvents).values({
        id: eventId,
        userId: current.user.id,
        eventType: "daily_collection",
        eventKey,
        ruleKey: rule.ruleKey,
        ruleVersion: rule.version,
        status: "credited",
        amountBaseUnits: amount
      });

      await transaction.insert(bdLedgerTransactions).values({
        id: transactionId,
        transactionType: "daily_collection",
        idempotencyKey: eventKey,
        referenceType: "bd_reward_event",
        referenceId: eventId
      });

      const postings = [
        { id: entryUserId, transactionId, accountId: userAccount.id, deltaBaseUnits: amount },
        { id: entryExpenseId, transactionId, accountId: expenseAccount.id, deltaBaseUnits: -amount }
      ];
      if (postings.reduce((total, posting) => total + posting.deltaBaseUnits, 0n) !== 0n) {
        throw new Error("BD ledger transaction is not balanced.");
      }
      await transaction.insert(bdLedgerEntries).values(postings);

      const [updatedAccount] = await transaction.update(bdAccounts)
        .set({
          balanceBaseUnits: userAccount.balanceBaseUnits + amount,
          lifetimeEarnedBaseUnits: userAccount.lifetimeEarnedBaseUnits + amount,
          updatedAt: now
        })
        .where(eq(bdAccounts.id, userAccount.id))
        .returning({
          availableBaseUnits: bdAccounts.balanceBaseUnits,
          lifetimeEarnedBaseUnits: bdAccounts.lifetimeEarnedBaseUnits
        });

      await transaction.update(bdAccounts)
        .set({
          balanceBaseUnits: expenseAccount.balanceBaseUnits - amount,
          updatedAt: now
        })
        .where(eq(bdAccounts.id, expenseAccount.id));

      await transaction.update(bdRewardRules)
        .set({
          consumedBaseUnits: rule.consumedBaseUnits + amount,
          updatedAt: now
        })
        .where(eq(bdRewardRules.id, rule.id));

      if (!updatedAccount) throw new Error("Unable to post the BD account balance.");

      return {
        amountBaseUnits: amount.toString(),
        availableBaseUnits: updatedAccount.availableBaseUnits.toString(),
        lifetimeEarnedBaseUnits: updatedAccount.lifetimeEarnedBaseUnits.toString()
      };
    });

    return context.json({
      account: {
        assetCode: "BD",
        availableBaseUnits: credited.availableBaseUnits,
        pendingBaseUnits: "0",
        lifetimeEarnedBaseUnits: credited.lifetimeEarnedBaseUnits
      },
      dailyCollection: {
        periodKey,
        status: "claimed",
        canClaim: false,
        claimed: true,
        rewardBaseUnits: credited.amountBaseUnits
      },
      creditedBaseUnits: credited.amountBaseUnits
    });
  } catch (error) {
    if (error instanceof DailyCollectionError) {
      return context.json({
        error: { code: error.code, message: error.message }
      }, 409);
    }
    throw error;
  }
});

  return routes;
}
