import assert from "node:assert/strict";
import test from "node:test";
import { createSolanaRoutes } from "./solana.js";
import { parseEnvironment } from "../config/env.js";

const baseBindings = {
  DATABASE_URL: "postgresql://brightglobe:secret@ep-example.neon.tech/brightglobe",
  BETTER_AUTH_URL: "https://api.example.com",
  BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-thirty-two-characters"
};

test("reports Solana disabled without contacting an RPC endpoint", async () => {
  const routes = createSolanaRoutes(parseEnvironment(baseBindings));
  const response = await routes.request("/status");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    network: "disabled",
    enabled: false,
    rpc: "not_checked"
  });
});

test("reports Devnet unavailable without exposing RPC details", async () => {
  const env = parseEnvironment({
    ...baseBindings,
    SOLANA_NETWORK: "devnet",
    SOLANA_RPC_URL: "https://127.0.0.1:1"
  });
  const routes = createSolanaRoutes(env);
  const response = await routes.request("/status");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    network: "devnet",
    enabled: true,
    rpc: "unavailable"
  });
});
