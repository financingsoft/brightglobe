import assert from "node:assert/strict";
import test from "node:test";
import { executeNextBgDevnetPayout } from "./bg-devnet-payout-executor.js";

test("disabled Devnet payout executor does not claim or call external ports", async () => {
  let claims = 0;
  const result = await executeNextBgDevnetPayout({
    config: { enabled: false, workerId: "test-worker" },
    repository: {
      claimNextQueued: async () => { claims += 1; return null; },
      persistSigned: async () => false,
      transition: async () => false,
      settleFinalizedPayoutOnce: async () => false
    },
    rpc: {
      getDevnetStatus: async () => { throw new Error("must not access RPC"); },
      getAccount: async () => null,
      getLamports: async () => 0,
      getMinimumBalanceForRentExemption: async () => 0,
      getLatestBlockhash: async () => { throw new Error("must not access RPC"); },
      getFeeForTransaction: async () => 0,
      simulateTransaction: async () => ({ err: null }),
      sendRawTransaction: async () => { throw new Error("must not broadcast"); },
      getSignatureStatus: async () => ({ confirmationStatus: null, err: null, slot: null }),
      getFinalizedTransaction: async () => null
    },
    signer: {
      provider: "external",
      sign: async () => { throw new Error("must not sign"); }
    }
  });
  assert.deepEqual(result, { outcome: "disabled" });
  assert.equal(claims, 0);
});

test("enabled executor returns empty without touching RPC when no queued payout exists", async () => {
  let claims = 0;
  let rpcCalls = 0;
  const result = await executeNextBgDevnetPayout({
    config: { enabled: true, workerId: "test-worker" },
    repository: {
      claimNextQueued: async () => { claims += 1; return null; },
      persistSigned: async () => false,
      transition: async () => false,
      settleFinalizedPayoutOnce: async () => false
    },
    rpc: {
      getDevnetStatus: async () => { rpcCalls += 1; throw new Error("unexpected RPC"); },
      getAccount: async () => null,
      getLamports: async () => 0,
      getMinimumBalanceForRentExemption: async () => 0,
      getLatestBlockhash: async () => { throw new Error("unexpected RPC"); },
      getFeeForTransaction: async () => 0,
      simulateTransaction: async () => ({ err: null }),
      sendRawTransaction: async () => { throw new Error("unexpected broadcast"); },
      getSignatureStatus: async () => ({ confirmationStatus: null, err: null, slot: null }),
      getFinalizedTransaction: async () => null
    },
    signer: {
      provider: "external",
      sign: async () => { throw new Error("unexpected signing"); }
    }
  });
  assert.deepEqual(result, { outcome: "empty" });
  assert.equal(claims, 1);
  assert.equal(rpcCalls, 0);
});
