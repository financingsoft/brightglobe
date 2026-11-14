import { createApp } from "./app.js";
import { createAuth } from "./auth.js";
import { parseEnvironment, type WorkerBindings } from "./config/env.js";
import { createDatabase } from "./db/client.js";

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
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
  }
};

export default worker;
