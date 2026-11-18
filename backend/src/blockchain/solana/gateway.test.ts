import assert from "node:assert/strict";
import test from "node:test";
import { createSolanaGateway, SOLANA_DEVNET_GENESIS_HASH, SolanaClusterMismatchError } from "./gateway.js";
import type { SolanaRpcClient } from "./rpc-client.js";

function rpcMock(overrides: Partial<SolanaRpcClient> = {}): SolanaRpcClient {
  return {
    request: async <T>(method: string): Promise<T> => {
      const values: Record<string, unknown> = {
        getGenesisHash: SOLANA_DEVNET_GENESIS_HASH,
        getSlot: { context: { slot: 100 }, value: 100 },
        getBlockHeight: 90,
        simulateTransaction: { context: { slot: 100 }, value: { err: null, logs: [], unitsConsumed: 123 } },
        sendTransaction: "5".repeat(88)
      };
      return values[method] as T;
    },
    getHealth: async () => "ok",
    getBlockHeight: async () => 90,
    getLatestBlockhash: async () => ({ context: { slot: 100 }, value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 120 } }),
    getSignatureStatuses: async () => ({ context: { slot: 100 }, value: [] }),
    ...overrides
  };
}

test("verifies the configured RPC endpoint is Solana Devnet", async () => {
  const gateway = createSolanaGateway("https://api.devnet.solana.com", rpcMock());
  const status = await gateway.getDevnetStatus();
  assert.equal(status.healthy, true);
  assert.equal(status.genesisHash, SOLANA_DEVNET_GENESIS_HASH);
  assert.equal(status.slot, 100);
  assert.equal(status.blockHeight, 90);
});

test("rejects an RPC endpoint connected to another cluster", async () => {
  const gateway = createSolanaGateway("https://example.com", rpcMock({
    request: async <T>(method: string): Promise<T> => (method === "getGenesisHash" ? "wrong-cluster" : 1) as T
  }));
  await assert.rejects(gateway.getDevnetStatus(), SolanaClusterMismatchError);
});

test("validates account info response shape", async () => {
  const gateway = createSolanaGateway("https://example.com", rpcMock({
    request: async <T>(method: string): Promise<T> => {
      if (method === "getAccountInfo") {
        return { context: { slot: 12 }, value: null } as T;
      }
      return null as T;
    }
  }));
  const result = await gateway.getAccountInfo("11111111111111111111111111111111");
  assert.equal(result.contextSlot, 12);
  assert.equal(result.account, null);
});


test("exposes validated recent blockhash and block height for transaction intents", async () => {
  const gateway = createSolanaGateway("https://example.com", rpcMock());
  const [blockhash, blockHeight] = await Promise.all([
    gateway.getLatestBlockhash("confirmed"),
    gateway.getBlockHeight("confirmed")
  ]);
  assert.equal(blockhash.blockhash, "11111111111111111111111111111111");
  assert.equal(blockhash.lastValidBlockHeight, 120);
  assert.equal(blockHeight, 90);
});

test("simulates an unsigned payout transaction and submits only a validated signature", async () => {
  const gateway = createSolanaGateway("https://example.com", rpcMock());
  const simulation = await gateway.simulateTransaction("AA==");
  assert.equal(simulation.err, null);
  assert.equal(simulation.contextSlot, 100);
  assert.equal(simulation.unitsConsumed, 123);
  assert.equal(await gateway.sendTransaction("AA=="), "5".repeat(88));
});

test("rejects malformed sendTransaction signatures", async () => {
  const gateway = createSolanaGateway("https://example.com", rpcMock({
    request: async <T>(method: string): Promise<T> => {
      if (method === "sendTransaction") return "not-a-signature" as T;
      return null as T;
    }
  }));
  await assert.rejects(gateway.sendTransaction("AA=="), /invalid transaction signature/i);
});
