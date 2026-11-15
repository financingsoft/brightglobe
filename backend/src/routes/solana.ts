import { Hono } from "hono";
import type { AppEnvironment } from "../config/env.js";
import { createSolanaGateway, type SolanaGateway } from "../blockchain/solana/gateway.js";

export function createSolanaRoutes(
  env: AppEnvironment,
  gatewayFactory: (endpoint: string) => SolanaGateway = (endpoint) => createSolanaGateway(endpoint)
) {
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
      const status = await gatewayFactory(env.SOLANA_RPC_URL).getDevnetStatus();
      return context.json({
        network: env.SOLANA_NETWORK,
        enabled: true,
        rpc: status.healthy ? "healthy" : "unhealthy"
      }, status.healthy ? 200 : 503);
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
