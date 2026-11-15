import assert from "node:assert/strict";
import test from "node:test";
import { createSolanaRpcClient, SolanaRpcRequestError } from "./rpc-client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("requires an HTTPS RPC endpoint", () => {
  assert.throws(() => createSolanaRpcClient("http://localhost:8899"), /HTTPS/);
});

test("requests health and validates JSON-RPC response identity", async () => {
  const client = createSolanaRpcClient("https://api.devnet.solana.com", {
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { id: number; method: string };
      assert.equal(body.method, "getHealth");
      return jsonResponse({ jsonrpc: "2.0", id: body.id, result: "ok" });
    }
  });

  assert.equal(await client.getHealth(), "ok");
});

test("surfaces JSON-RPC errors without leaking request payloads", async () => {
  const client = createSolanaRpcClient("https://api.devnet.solana.com", {
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { id: number };
      return jsonResponse({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32005, message: "Node is unhealthy" }
      });
    }
  });

  await assert.rejects(client.getHealth(), (error: unknown) =>
    error instanceof SolanaRpcRequestError &&
    error.code === -32005 &&
    error.message === "Node is unhealthy"
  );
});

test("rejects non-success HTTP responses", async () => {
  const client = createSolanaRpcClient("https://api.devnet.solana.com", {
    fetchImpl: async () => jsonResponse({}, 503)
  });

  await assert.rejects(client.getHealth(), /HTTP 503/);
});

test("validates timeout bounds", () => {
  assert.throws(
    () => createSolanaRpcClient("https://api.devnet.solana.com", { timeoutMs: 0 }),
    /timeout/
  );
});

test("retries transient HTTP failures within the configured bound", async () => {
  let attempts = 0;
  const client = createSolanaRpcClient("https://api.devnet.solana.com", {
    maxRetries: 2,
    fetchImpl: async (_input, init) => {
      attempts += 1;
      const body = JSON.parse(String(init?.body)) as { id: number };
      if (attempts === 1) return jsonResponse({}, 503);
      return jsonResponse({ jsonrpc: "2.0", id: body.id, result: "ok" });
    }
  });
  assert.equal(await client.getHealth(), "ok");
  assert.equal(attempts, 2);
});

test("does not retry deterministic client HTTP errors", async () => {
  let attempts = 0;
  const client = createSolanaRpcClient("https://api.devnet.solana.com", {
    maxRetries: 3,
    fetchImpl: async () => {
      attempts += 1;
      return jsonResponse({}, 400);
    }
  });
  await assert.rejects(client.getHealth(), /HTTP 400/);
  assert.equal(attempts, 1);
});

test("bounds retry configuration", () => {
  assert.throws(() => createSolanaRpcClient("https://api.devnet.solana.com", { maxRetries: 4 }), /retries/);
});
