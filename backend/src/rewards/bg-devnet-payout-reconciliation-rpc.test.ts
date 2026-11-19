import assert from "node:assert/strict";
import test from "node:test";
import type { SolanaGateway } from "../blockchain/solana/gateway.js";
import { createSolanaBgPayoutReconciliationRpc } from "./bg-devnet-payout-reconciliation-rpc.js";

function gatewayStub(overrides: Partial<SolanaGateway> = {}): SolanaGateway {
  return {
    getDevnetStatus: async () => ({
      healthy: true,
      genesisHash: "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC",
      slot: 1,
      blockHeight: 2
    }),
    getAccountInfo: async () => ({ contextSlot: 1, account: null }),
    getLatestBlockhash: async () => ({ blockhash: "blockhash", lastValidBlockHeight: 10, contextSlot: 1 }),
    getBlockHeight: async () => 99,
    getTransaction: async () => null,
    getTokenAccountsByOwner: async () => [],
    getSignaturesForAddress: async () => [],
    getSignatureStatuses: async () => ({
      context: { slot: 99 },
      value: [{ slot: 98, confirmations: null, err: null, confirmationStatus: "finalized" }]
    }),
    ...overrides
  };
}

test("Solana reconciliation adapter reads finalized status and never exposes broadcast ports", async () => {
  let searched: readonly string[] = [];
  const gateway = gatewayStub({
    getSignatureStatuses: async (signatures) => {
      searched = signatures;
      return {
        context: { slot: 99 },
        value: [{ slot: 98, confirmations: null, err: null, confirmationStatus: "finalized" }]
      };
    }
  });
  const rpc = createSolanaBgPayoutReconciliationRpc(gateway, { archiveHistoryEnabled: false });
  assert.deepEqual(await rpc.getSignatureStatus("persisted-signature"), {
    confirmationStatus: "finalized",
    err: null,
    slot: 98
  });
  assert.deepEqual(searched, ["persisted-signature"]);
  assert.equal(await rpc.getFinalizedBlockHeight(), 99);
  assert.equal("sendRawTransaction" in rpc, false);
  assert.equal("sign" in rpc, false);
});

test("history absence is authoritative only with explicitly enabled archive coverage", async () => {
  const gateway = gatewayStub({
    getSignaturesForAddress: async () => []
  });
  const ordinary = createSolanaBgPayoutReconciliationRpc(gateway, { archiveHistoryEnabled: false });
  const archive = createSolanaBgPayoutReconciliationRpc(gateway, { archiveHistoryEnabled: true });
  assert.deepEqual(await ordinary.getSignatureHistoryEvidence({
    feePayerAddress: "fee-payer",
    signature: "missing-signature"
  }), { found: false, complete: false });
  assert.deepEqual(await archive.getSignatureHistoryEvidence({
    feePayerAddress: "fee-payer",
    signature: "missing-signature"
  }), { found: false, complete: true });
});

test("found signature is returned without asserting exhaustive history coverage", async () => {
  const gateway = gatewayStub({
    getSignaturesForAddress: async () => [{
      signature: "found-signature",
      slot: 50,
      err: null,
      confirmationStatus: "finalized"
    }]
  });
  const rpc = createSolanaBgPayoutReconciliationRpc(gateway, { archiveHistoryEnabled: true });
  assert.deepEqual(await rpc.getSignatureHistoryEvidence({
    feePayerAddress: "fee-payer",
    signature: "found-signature"
  }), { found: true, complete: false });
});

test("bounded history scan cannot claim completeness when page budget is exhausted", async () => {
  let calls = 0;
  const gateway = gatewayStub({
    getSignaturesForAddress: async () => {
      calls += 1;
      return Array.from({ length: 1000 }, (_, index) => ({
        signature: "signature-" + index,
        slot: 1000 - index,
        err: null,
        confirmationStatus: "finalized" as const
      }));
    }
  });
  const rpc = createSolanaBgPayoutReconciliationRpc(gateway, {
    archiveHistoryEnabled: true,
    maxHistoryPages: 2
  });
  assert.deepEqual(await rpc.getSignatureHistoryEvidence({
    feePayerAddress: "fee-payer",
    signature: "not-present"
  }), { found: false, complete: false });
  assert.equal(calls, 2);
});

test("invalid archive page limits are rejected", () => {
  assert.throws(() => createSolanaBgPayoutReconciliationRpc(gatewayStub(), {
    archiveHistoryEnabled: true,
    maxHistoryPages: 0
  }), RangeError);
});
