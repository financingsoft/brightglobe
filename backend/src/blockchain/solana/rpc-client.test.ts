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
