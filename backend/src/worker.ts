import { createApp } from "./app.js";
import { createAuth } from "./auth.js";
import { parseEnvironment, type WorkerBindings } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { createSolanaGateway } from "./blockchain/solana/gateway.js";
import { scanConfiguredBgAsset, IndexerAssetNotConfiguredError } from "./indexer/indexer-service.js";
import { createDrizzleBgDevnetPayoutRepository } from "./rewards/bg-devnet-payout-repository.js";
import { reconcileBgDevnetPayouts } from "./rewards/bg-devnet-payout-reconciler.js";
import { createSolanaBgPayoutReconciliationRpc } from "./rewards/bg-devnet-payout-reconciliation-rpc.js";

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerScheduledController {
  scheduledTime: number;
  cron: string;
}

const worker = {
  async fetch(
    request: Request,
    bindings: WorkerBindings,
    executionContext: WorkerExecutionContext
  ): Promise<Response> {
    let env;
    try {
      env = parseEnvironment(bindings);
    } catch (error: unknown) {
      console.error("[BrightGlobe Worker] Invalid runtime configuration:", error);
      return Response.json({
        error: {
          code: "SERVICE_CONFIGURATION_ERROR",
          message: "The API service is not configured correctly."
        }
      }, { status: 503 });
    }

    const { db, pool } = createDatabase(env.DATABASE_URL);
    const pendingBackgroundTasks = new Set<Promise<unknown>>();
    const scheduleBackgroundTask = (promise: Promise<unknown>) => {
      const tracked = promise
        .catch((error: unknown) => {
          console.error("[BrightGlobe Worker] Deferred task failed:", error);
        })
        .finally(() => pendingBackgroundTasks.delete(tracked));
      pendingBackgroundTasks.add(tracked);
      executionContext.waitUntil(tracked);
    };

    try {
      const auth = createAuth(db, env, scheduleBackgroundTask);
      const response = await createApp({ db, auth, env }).fetch(request, bindings);

      // Keep the request-scoped pool alive until Better Auth's deferred work is done.
      const cleanup = Promise.allSettled([...pendingBackgroundTasks]).then(async () => {
        try {
          await pool.end();
        } catch (error: unknown) {
          console.error("[BrightGlobe Worker] Database connection cleanup failed:", error);
        }
      });
      executionContext.waitUntil(cleanup);
      return response;
    } catch (error) {
      await pool.end().catch((cleanupError: unknown) => {
        console.error("[BrightGlobe Worker] Database connection cleanup failed:", cleanupError);
      });
      throw error;
    }
  },

  async scheduled(
    controller: WorkerScheduledController,
    bindings: WorkerBindings,
    executionContext: WorkerExecutionContext
  ): Promise<void> {
    let env;
    try {
      env = parseEnvironment(bindings);
    } catch (error: unknown) {
      console.error("[BrightGlobe Indexer] Invalid runtime configuration:", error);
      return;
    }

    // Production remains inert while the configured chain is disabled.
    if (env.SOLANA_NETWORK !== "devnet") return;

    const task = (async () => {
      const { db, pool } = createDatabase(env.DATABASE_URL);
      try {
        const gateway = createSolanaGateway(env.SOLANA_RPC_URL);
        const cluster = await gateway.getDevnetStatus();
        if (!cluster.healthy) {
          throw new Error("The configured Solana Devnet RPC is not healthy.");
        }
        try {
          const result = await scanConfiguredBgAsset(db, gateway, {
            fromSlot: BigInt(cluster.slot),
            toSlot: BigInt(cluster.slot),
            maxSourcesPerRun: 10
          });
          console.log("[BrightGlobe Indexer] Scheduled scan completed:", JSON.stringify({
            cron: controller.cron,
            scheduledTime: controller.scheduledTime,
            ...result
          }));
        } catch (error: unknown) {
          if (error instanceof IndexerAssetNotConfiguredError) {
            console.log("[BrightGlobe Indexer] BG asset is still a draft; scheduled scan skipped.");
          } else {
            throw error;
          }
        }

        if (env.BG_PAYOUT_RECONCILIATION_ENABLED) {
          const repository = createDrizzleBgDevnetPayoutRepository(db);
          const reconciliationRpc = createSolanaBgPayoutReconciliationRpc(gateway, {
            archiveHistoryEnabled: env.BG_PAYOUT_ARCHIVE_HISTORY_ENABLED,
            maxHistoryPages: 3
          });
          const reconciliation = await reconcileBgDevnetPayouts({
            config: {
              enabled: true,
              workerId: `globe-bg-payout-reconciler-${controller.scheduledTime}`,
              batchSize: env.BG_PAYOUT_RECONCILIATION_BATCH_SIZE
            },
            repository,
            rpc: reconciliationRpc
          });
          console.log("[BrightGlobe BG Payout Reconciler] Scheduled pass completed:", JSON.stringify({
            cron: controller.cron,
            scheduledTime: controller.scheduledTime,
            ...reconciliation
          }));
        }
      } catch (error: unknown) {
        console.error("[BrightGlobe Scheduled Worker] Background task failed:", error);
        throw error;
      } finally {
        await pool.end();
      }
    })();

    executionContext.waitUntil(task.catch((error: unknown) => {
      console.error("[BrightGlobe Indexer] Background execution failed:", error);
    }));
  }
};

export default worker;
