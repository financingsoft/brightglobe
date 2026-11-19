import assert from "node:assert/strict";
import test from "node:test";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";
import type {
  BgDevnetPayoutReconciliationCandidate,
  BgDevnetPayoutRepository
} from "./bg-devnet-payout-executor.js";
import {
  reconcileBgDevnetPayouts,
  type BgDevnetPayoutReconciliationRpc
} from "./bg-devnet-payout-reconciler.js";

const signature = "reconciliation-signature";
const recentBlockhash = "recent-blockhash-for-bg-payout";
const source = "source-token-account";
const destination = "destination-token-account";
const authority = "treasury-authority";
const feePayer = "fee-payer";
const wallet = "recipient-wallet";
const mint = "bg-devnet-mint";

function candidate(
  overrides: Partial<BgDevnetPayoutReconciliationCandidate> = {}
): BgDevnetPayoutReconciliationCandidate {
  return {
    id: "payout-1",
    status: "reconciliation_required",
    network: "devnet",
    mintAddress: mint,
    tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
    sourceTokenAccount: source,
    feePayerAddress: feePayer,
    treasuryAuthorityAddress: authority,
    destinationWallet: wallet,
    destinationTokenAccount: destination,
    amountBaseUnits: 42n,
    decimals: 9,
    signature,
    recentBlockhash,
    lastValidBlockHeight: 100n,
    finalizedSlot: null,
    ...overrides
  };
}

function finalizedTransaction(overrides: {
  destination?: string;
  err?: unknown;
  slot?: number;
} = {}): unknown {
  return {
    slot: overrides.slot ?? 777,
    transaction: {
      signatures: [signature],
      message: {
        recentBlockhash,
        instructions: [{
          programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
          parsed: {
            type: "transferChecked",
            info: {
              source,
              destination: overrides.destination ?? destination,
              authority,
              mint,
              amount: "42",
              decimals: 9
            }
          }
        }]
      }
    },
    meta: { err: overrides.err ?? null, innerInstructions: [] }
  };
}

function harness(options: {
  item?: BgDevnetPayoutReconciliationCandidate;
  observation?: { confirmationStatus: "processed" | "confirmed" | "finalized" | null; err: unknown | null; slot: number | null };
  transaction?: unknown | null;
  blockHeight?: number;
  history?: { found: boolean; complete: boolean };
  settled?: boolean;
  cluster?: { healthy: boolean; genesisHash: string };
} = {}) {
  const item = options.item ?? candidate();
  const transitions: Array<{ from: string; to: string; evidence: Record<string, unknown> }> = [];
  let claims = 0;
  let settlements = 0;
  const repository = {
    claimNextQueued: async () => null,
    claimReconciliationBatch: async () => { claims += 1; return [item]; },
    persistSigned: async () => false,
    transition: async (input: { from: string; to: string; evidence: Record<string, unknown> }) => {
      transitions.push(input);
      return true;
    },
    settleFinalizedPayoutOnce: async () => { settlements += 1; return options.settled ?? true; }
  } as unknown as BgDevnetPayoutRepository;
  const rpc: BgDevnetPayoutReconciliationRpc = {
    getDevnetStatus: async () => options.cluster ?? { healthy: true, genesisHash: SOLANA_DEVNET_GENESIS_HASH },
    getSignatureStatus: async () => options.observation ?? { confirmationStatus: null, err: null, slot: null },
    getFinalizedBlockHeight: async () => options.blockHeight ?? 101,
    getFinalizedTransaction: async () => options.transaction === undefined ? null : options.transaction,
    getSignatureHistoryEvidence: async () => options.history ?? { found: false, complete: false }
  };
  return { repository, rpc, transitions, get claims() { return claims; }, get settlements() { return settlements; } };
}

test("disabled reconciler does not claim records or call RPC", async () => {
  const h = harness();
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: false, workerId: "test" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.outcome, "disabled");
  assert.equal(h.claims, 0);
});

test("finalized exact transfer is verified and settled once", async () => {
  const h = harness({
    observation: { confirmationStatus: "finalized", err: null, slot: 777 },
    transaction: finalizedTransaction()
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.paid, 1);
  assert.equal(h.settlements, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["reconciliation_required", "finalized"]
  ]);
  assert.equal(h.transitions[0]?.evidence.finalizedTransferVerified, true);
});

test("finalized transaction mismatch is quarantined, never paid", async () => {
  const h = harness({
    observation: { confirmationStatus: "finalized", err: null, slot: 777 },
    transaction: finalizedTransaction({ destination: "unexpected-token-account" })
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.quarantined, 1);
  assert.equal(h.settlements, 0);
  assert.equal(h.transitions[0]?.to, "quarantined");
});

test("confirmed signature advances only to confirmed and remains reserved", async () => {
  const h = harness({
    observation: { confirmationStatus: "confirmed", err: null, slot: 776 }
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.awaitingFinality, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["reconciliation_required", "confirmed"]
  ]);
  assert.equal(h.settlements, 0);
});

test("a signed payout with a live blockhash is never re-signed or expired", async () => {
  const h = harness({
    item: candidate({ status: "signed" }),
    blockHeight: 100,
    history: { found: false, complete: false }
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.awaitingFinality, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["signed", "reconciliation_required"]
  ]);
  assert.equal(h.settlements, 0);
});

test("authoritative archive discovery can finalize the original signature after status cache expiry", async () => {
  const h = harness({
    item: candidate({ status: "reconciliation_required" }),
    blockHeight: 101,
    history: { found: true, complete: false },
    transaction: finalizedTransaction()
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.paid, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["reconciliation_required", "finalized"]
  ]);
});

test("missing status with incomplete history never expires or releases reservation", async () => {
  const h = harness({
    item: candidate({ status: "submitted" }),
    blockHeight: 101,
    history: { found: false, complete: false }
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.deferred, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["submitted", "reconciliation_required"]
  ]);
  assert.equal(h.settlements, 0);
});

test("expired blockhash plus exhaustive signature absence safely expires payout", async () => {
  const h = harness({
    item: candidate({ status: "submitted" }),
    blockHeight: 101,
    history: { found: false, complete: true }
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.expired, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["submitted", "reconciliation_required"],
    ["reconciliation_required", "expired"]
  ]);
  assert.equal(h.transitions[1]?.evidence.definitiveAbsenceAfterExpiry, true);
});

test("finalized failed transaction is marked failed only with matching envelope", async () => {
  const h = harness({
    observation: { confirmationStatus: "finalized", err: { InstructionError: [0, "Custom"] }, slot: 777 },
    transaction: finalizedTransaction({ err: { InstructionError: [0, "Custom"] } })
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.failed, 1);
  assert.equal(h.transitions[0]?.to, "failed");
  assert.equal(h.settlements, 0);
});

test("finalized ledger settlement failure is deferred for idempotent retry", async () => {
  const h = harness({
    item: candidate({ status: "finalized", finalizedSlot: 777n }),
    settled: false
  });
  const result = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "reconciler" },
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.deferred, 1);
  assert.equal(h.settlements, 1);
  assert.equal(h.transitions.length, 0);
});
