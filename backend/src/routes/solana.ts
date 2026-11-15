import { Hono } from "hono";
import type { AppEnvironment } from "../config/env.js";
import { createSolanaRpcClient } from "../blockchain/solana/rpc-client.js";

export function createSolanaRoutes(env: AppEnvironment) {
  const routes = new Hono();

  routes.get("/status", async (context) => {
    if (env.SOLANA_NETWORK === "disabled") {
      return context.json({
        network: "disabled",
        enabled: false,
        rpc: "not_checked"
      });
    }

    try {
      const rpc = createSolanaRpcClient(env.SOLANA_RPC_URL);
      const health = await rpc.getHealth();
      return context.json({
        network: env.SOLANA_NETWORK,
        enabled: true,
        rpc: health === "ok" ? "healthy" : "unhealthy"
      }, health === "ok" ? 200 : 503);
    } catch {
      return context.json({
        network: env.SOLANA_NETWORK,
        enabled: true,
        rpc: "unavailable"
      }, 503);
    }
  });

  return routes;
}
