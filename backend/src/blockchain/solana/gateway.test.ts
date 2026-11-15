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
        getBlockHeight: 90
      };
      return values[method] as T;
    },
    getHealth: async () => "ok",
    getLatestBlockhash: async () => ({ context: { slot: 100 }, value: { blockhash: "hash", lastValidBlockHeight: 120 } }),
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
