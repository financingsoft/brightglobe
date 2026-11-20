import assert from "node:assert/strict";
import test from "node:test";
import type { SolanaGateway } from "../blockchain/solana/gateway.js";
import type { SolanaRpcClient } from "../blockchain/solana/rpc-client.js";
import { createSolanaBgDevnetPayoutRpc } from "./bg-devnet-payout-rpc.js";

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wireTransaction(signatures: Uint8Array[], message = Uint8Array.from([0x80, 0x01, 0x02])): string {
  const bytes = new Uint8Array(1 + signatures.length * 64 + message.length);
  bytes[0] = signatures.length;
  let offset = 1;
  for (const signature of signatures) {
    bytes.set(signature, offset);
    offset += signature.length;
  }
  bytes.set(message, offset);
  return encodeBase64(bytes);
}

function createHarness(options: {
  signatureStatus?: {
    slot: number;
    confirmations: number | null;
    err: unknown | null;
    confirmationStatus?: "processed" | "confirmed" | "finalized";
  } | null;
  requestResult?: (method: string, params: readonly unknown[]) => unknown;
} = {}) {
  const calls: Array<{ method: string; params: readonly unknown[] }> = [];
  const gateway = {
    getDevnetStatus: async () => ({
      healthy: true,
      genesisHash: "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC",
      slot: 100,
      blockHeight: 90
    }),
    getAccountInfo: async (_address: string, commitment: string) => {
      assert.equal(commitment, "finalized");
      return {
        contextSlot: 101,
        account: {
          data: ["AQID", "base64"],
          executable: false,
          lamports: 2_039_280,
          owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          rentEpoch: 0
        }
      };
    },
    getLatestBlockhash: async (commitment: string) => {
      assert.equal(commitment, "confirmed");
      return {
        blockhash: "11111111111111111111111111111111",
        lastValidBlockHeight: 500,
        contextSlot: 102
      };
    },
    getSignatureStatuses: async (signatures: readonly string[]) => ({
      context: { slot: 103 },
      value: signatures.map(() => options.signatureStatus === undefined
        ? {
            slot: 103,
            confirmations: null,
            err: null,
            confirmationStatus: "confirmed" as const
          }
        : options.signatureStatus)
    }),
    getTransaction: async (signature: string) => ({ signature, slot: 104, meta: { err: null } })
  } as unknown as SolanaGateway;

  const rpc = {
    request: async <T>(method: string, params: readonly unknown[] = []): Promise<T> => {
      calls.push({ method, params });
      const result = options.requestResult
        ? options.requestResult(method, params)
        : method === "getBalance"
          ? { context: { slot: 101 }, value: 9_000_000 }
          : method === "getMinimumBalanceForRentExemption"
            ? 2_000_000
            : method === "getFeeForMessage"
              ? { context: { slot: 102 }, value: 5_000 }
              : method === "simulateTransaction"
                ? { context: { slot: 102 }, value: { err: null } }
                : method === "sendTransaction"
                  ? "5N8s3hJf8vQ8m2gV7zP6w3xY9aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFg"
                  : undefined;
      return result as T;
    }
  } as unknown as SolanaRpcClient;

  return { rpc: createSolanaBgDevnetPayoutRpc(gateway, rpc), calls };
}

test("Devnet payout RPC adapter uses the verified cluster and finalized account snapshots", async () => {
  const h = createHarness();
  assert.deepEqual(await h.rpc.getDevnetStatus(), {
    healthy: true,
    genesisHash: "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC"
  });
  assert.deepEqual(await h.rpc.getAccount("mint-address"), {
    owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    dataBase64: "AQID",
    executable: false,
    lamports: 2_039_280
  });
  assert.deepEqual(await h.rpc.getLatestBlockhash(), {
    blockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: 500
  });
});

test("Devnet payout RPC adapter validates finalized fee-payer balance and ATA rent", async () => {
  const h = createHarness();
  assert.equal(await h.rpc.getLamports("fee-payer"), 9_000_000);
  assert.equal(await h.rpc.getMinimumBalanceForRentExemption(165), 2_000_000);
  assert.deepEqual(h.calls.map((call) => call.method), [
    "getBalance",
    "getMinimumBalanceForRentExemption"
  ]);
  assert.deepEqual(h.calls[0]?.params[1], { commitment: "finalized" });
  assert.deepEqual(h.calls[1]?.params[1], { commitment: "finalized" });
  await assert.rejects(() => h.rpc.getMinimumBalanceForRentExemption(0), RangeError);
});

test("fee quote extracts the serialized v0 message from the unsigned transaction wire format", async () => {
  const h = createHarness();
  const message = Uint8Array.from([0x80, 0x01, 0x02, 0x03]);
  const unsigned = wireTransaction([new Uint8Array(64), new Uint8Array(64)], message);
  assert.equal(await h.rpc.getFeeForTransaction(unsigned), 5_000);
  assert.equal(h.calls[0]?.method, "getFeeForMessage");
  assert.equal(h.calls[0]?.params[0], encodeBase64(message));
  assert.deepEqual(h.calls[0]?.params[1], { commitment: "confirmed" });
});

test("fee quote rejects malformed, unsupported, or partially signed transaction wire data", async () => {
  const h = createHarness();
  await assert.rejects(() => h.rpc.getFeeForTransaction("not-base64"));
  await assert.rejects(() => h.rpc.getFeeForTransaction(wireTransaction([new Uint8Array(64)])));
  const partiallySigned = wireTransaction([
    Uint8Array.from({ length: 64 }, () => 1),
    new Uint8Array(64)
  ]);
  await assert.rejects(() => h.rpc.getFeeForTransaction(partiallySigned));
});

test("simulation accepts only unsigned v0 transactions and broadcast requires both signer slots", async () => {
  const h = createHarness();
  const unsigned = wireTransaction([new Uint8Array(64), new Uint8Array(64)]);
  const signed = wireTransaction([
    Uint8Array.from({ length: 64 }, () => 1),
    Uint8Array.from({ length: 64 }, () => 2)
  ]);

  assert.deepEqual(await h.rpc.simulateTransaction(unsigned), { err: null });
  assert.equal(h.calls[0]?.method, "simulateTransaction");
  assert.deepEqual(h.calls[0]?.params[1], {
    encoding: "base64",
    commitment: "confirmed",
    sigVerify: false,
    replaceRecentBlockhash: false
  });

  assert.equal(await h.rpc.sendRawTransaction(signed), "5N8s3hJf8vQ8m2gV7zP6w3xY9aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeFg");
  assert.equal(h.calls[1]?.method, "sendTransaction");
  assert.deepEqual(h.calls[1]?.params[1], {
    encoding: "base64",
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 0
  });
  await assert.rejects(() => h.rpc.sendRawTransaction(unsigned));
});

test("signature status and finalized transaction reads delegate to the verified gateway", async () => {
  const h = createHarness();
  assert.deepEqual(await h.rpc.getSignatureStatus("payout-signature"), {
    confirmationStatus: "confirmed",
    err: null,
    slot: 103
  });
  assert.deepEqual(await h.rpc.getFinalizedTransaction("payout-signature"), {
    signature: "payout-signature",
    slot: 104,
    meta: { err: null }
  });

  const absent = createHarness({ signatureStatus: null });
  assert.deepEqual(await absent.rpc.getSignatureStatus("missing-signature"), {
    confirmationStatus: null,
    err: null,
    slot: null
  });
});
