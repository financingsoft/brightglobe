import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";

const server = serve({
  fetch: app.fetch,
  port: env.PORT
}, (info) => {
  console.info("BrightGlobe backend listening on port " + info.port);
});

async function shutdown() {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await pool.end();
}

process.once("SIGINT", () => {
  void shutdown().catch((error: unknown) => {
    console.error("Shutdown failed:", error);
    process.exitCode = 1;
  });
});
process.once("SIGTERM", () => {
  void shutdown().catch((error: unknown) => {
    console.error("Shutdown failed:", error);
    process.exitCode = 1;
  });
});
