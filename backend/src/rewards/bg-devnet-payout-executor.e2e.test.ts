import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSIC_SPL_TOKEN_PROGRAM_ID,
  parseClassicSplMint,
  parseClassicSplTokenAccount
} from "../blockchain/solana/token/classic-token.js";
import { decodeSolanaAddress } from "../blockchain/solana/address.js";
import {
  deriveClassicSplAssociatedTokenAccounts
} from "../blockchain/solana/transfer-builder.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";
import type {
  BgDevnetPayoutIntent,
  BgDevnetPayoutReconciliationCandidate,
  BgDevnetPayoutRepository,
  BgDevnetPayoutRpc
} from "./bg-devnet-payout-executor.js";
import { executeNextBgDevnetPayout } from "./bg-devnet-payout-executor.js";
import {
  validateBgPayoutSigningRequest,
  type BgPayoutSigningRequest
} from "./bg-payout-signer.js";
import {
  reconcileBgDevnetPayouts,
  type BgDevnetPayoutReconciliationRpc
} from "./bg-devnet-payout-reconciler.js";

const FEE_PAYER = "11111111111111111111111111111111";
const TREASURY_AUTHORITY = "Vote111111111111111111111111111111111111111";
const RECIPIENT = "Stake11111111111111111111111111111111111111";
const MINT = "So11111111111111111111111111111111111111112";
const BLOCKHASH = FEE_PAYER;
const SIGNATURE = "fake-devnet-bg-payout-signature";

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function accountBytes(address: string, offset: number): Uint8Array {
  const decoded = decodeSolanaAddress(address);
  assert.ok(decoded);
  const bytes = new Uint8Array(165);
  bytes.set(decoded, offset);
  return bytes;
}

async function fixture(options: {
  sendError?: boolean;
  rpcSignature?: string;
  simulationError?: unknown | null;
  feePayerLamports?: number;
  finalizedTransaction?: unknown | null;
} = {}) {
  const accounts = await deriveClassicSplAssociatedTokenAccounts({
    sourceOwnerAddress: TREASURY_AUTHORITY,
    destinationOwnerAddress: RECIPIENT,
    mintAddress: MINT
  });
  const mintData = new Uint8Array(82);
  mintData[44] = 9;
  mintData[45] = 1;
  const sourceData = accountBytes(MINT, 0);
  sourceData.set(decodeSolanaAddress(TREASURY_AUTHORITY)!, 32);
  new DataView(sourceData.buffer).setBigUint64(64, 1_000_000n, true);
  sourceData[108] = 1;

  // Assert that the same account payloads used by the fake RPC satisfy the
  // production parsers before the executor consumes them.
  assert.equal(parseClassicSplMint({
    owner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
    dataBase64: encodeBase64(mintData)
  }).decimals, 9);
  assert.equal(parseClassicSplTokenAccount({
    owner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
    dataBase64: encodeBase64(sourceData)
  }).owner, TREASURY_AUTHORITY);

  const intent: BgDevnetPayoutIntent = {
    id: "payout-e2e-1",
    network: "devnet",
    mintAddress: MINT,
    tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
    sourceTokenAccount: accounts.sourceTokenAccount,
    feePayerAddress: FEE_PAYER,
    treasuryAuthorityAddress: TREASURY_AUTHORITY,
    destinationWallet: RECIPIENT,
    destinationTokenAccount: accounts.destinationTokenAccount,
    amountBaseUnits: 100n,
    signerProvider: "external",
    signerKeyReference: "external://brightglobe/devnet/test",
    decimals: 9,
    maxSinglePayoutBaseUnits: 1_000n,
    remainingRollingOutflowBaseUnits: 5_000n
  };

  const transitions: Array<{
    from: string;
    to: string;
    signature?: string;
    evidence: Record<string, unknown>;
  }> = [];
  let persisted = false;
  let currentStatus = "queued";
  let signerCalls = 0;
  let broadcastCalls = 0;
  let settlementCalls = 0;

  const repository = {
    claimNextQueued: async () => {
      currentStatus = "signing";
      return intent;
    },
    claimReconciliationBatch: async () => {
      if (!["signed", "submitted", "confirmed", "finalized", "reconciliation_required"].includes(currentStatus)) return [];
      const candidate: BgDevnetPayoutReconciliationCandidate = {
        id: intent.id,
        status: currentStatus as BgDevnetPayoutReconciliationCandidate["status"],
        network: intent.network,
        mintAddress: intent.mintAddress,
        tokenProgram: intent.tokenProgram,
        sourceTokenAccount: intent.sourceTokenAccount,
        feePayerAddress: intent.feePayerAddress,
        treasuryAuthorityAddress: intent.treasuryAuthorityAddress,
        destinationWallet: intent.destinationWallet,
        destinationTokenAccount: intent.destinationTokenAccount,
        amountBaseUnits: intent.amountBaseUnits,
        decimals: intent.decimals,
        signature: persisted ? SIGNATURE : null,
        recentBlockhash: persisted ? BLOCKHASH : null,
        lastValidBlockHeight: persisted ? 500n : null,
        finalizedSlot: null
      };
      return [candidate];
    },
    persistSigned: async (input: {
      payoutIntentId: string;
      signature: string;
      recentBlockhash: string;
      lastValidBlockHeight: bigint;
    }) => {
      assert.equal(input.payoutIntentId, intent.id);
      assert.equal(input.signature, SIGNATURE);
      assert.equal(input.recentBlockhash, BLOCKHASH);
      assert.equal(input.lastValidBlockHeight, 500n);
      persisted = true;
      currentStatus = "signed";
      return true;
    },
    transition: async (input: {
      from: string;
      to: string;
      signature?: string;
      evidence: Record<string, unknown>;
    }) => {
      transitions.push(input);
      currentStatus = input.to;
      return true;
    },
    settleFinalizedPayoutOnce: async (input: {
      payoutIntentId: string;
      signature: string;
      finalizedSlot: bigint;
    }) => {
      settlementCalls += 1;
      currentStatus = "paid";
      assert.equal(input.payoutIntentId, intent.id);
      assert.equal(input.signature, SIGNATURE);
      assert.equal(input.finalizedSlot, 123n);
      return true;
    }
  } as unknown as BgDevnetPayoutRepository;

  const finalizedTransaction = options.finalizedTransaction === undefined
    ? {
        slot: 123,
        transaction: {
          signatures: [SIGNATURE],
          message: {
            recentBlockhash: BLOCKHASH,
            instructions: [{
              programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
              parsed: {
                type: "transferChecked",
                info: {
                  source: accounts.sourceTokenAccount,
                  destination: accounts.destinationTokenAccount,
                  authority: TREASURY_AUTHORITY,
                  mint: MINT,
                  amount: "100",
                  decimals: 9
                }
              }
            }]
          }
        },
        meta: { err: null, innerInstructions: [] }
      }
    : options.finalizedTransaction;

  const rpc: BgDevnetPayoutRpc = {
    getDevnetStatus: async () => ({ healthy: true, genesisHash: SOLANA_DEVNET_GENESIS_HASH }),
    getAccount: async (address) => {
      if (address === MINT) {
        return {
          owner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
          dataBase64: encodeBase64(mintData),
          executable: false,
          lamports: 1_461_600
        };
      }
      if (address === accounts.sourceTokenAccount) {
        return {
          owner: CLASSIC_SPL_TOKEN_PROGRAM_ID,
          dataBase64: encodeBase64(sourceData),
          executable: false,
          lamports: 2_039_280
        };
      }
      if (address === accounts.destinationTokenAccount) return null;
      return null;
    },
    getLamports: async () => options.feePayerLamports ?? 10_000_000,
    getMinimumBalanceForRentExemption: async () => 2_000_000,
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 500 }),
    getFeeForTransaction: async () => 5_000,
    simulateTransaction: async () => ({ err: options.simulationError ?? null }),
    sendRawTransaction: async () => {
      broadcastCalls += 1;
      assert.equal(persisted, true, "signature and blockhash must be persisted before broadcast");
      if (options.sendError) throw new Error("simulated RPC timeout after send");
      return options.rpcSignature ?? SIGNATURE;
    },
    getSignatureStatus: async () => ({
      confirmationStatus: "finalized",
      err: null,
      slot: 123
    }),
    getFinalizedTransaction: async () => finalizedTransaction
  };

  const signer = {
    provider: "external" as const,
    sign: async (request: BgPayoutSigningRequest) => {
      signerCalls += 1;
      validateBgPayoutSigningRequest(request);
      return {
        // This is deliberately a fake signer: the test proves orchestration,
        // not cryptographic signing or real Solana broadcast.
        signedTransactionBase64: request.unsignedTransactionBase64,
        transactionSignature: SIGNATURE
      };
    }
  };

  const result = await executeNextBgDevnetPayout({
    config: { enabled: true, workerId: "e2e-test-worker" },
    repository,
    rpc,
    signer
  });

  return {
    result,
    intent,
    repository,
    rpc,
    transitions,
    get persisted() { return persisted; },
    get signerCalls() { return signerCalls; },
    get broadcastCalls() { return broadcastCalls; },
    get settlementCalls() { return settlementCalls; }
  };
}

test("Devnet payout executes through exact finalized verification and one ledger settlement", async () => {
  const h = await fixture();
  assert.deepEqual(h.result, {
    outcome: "paid",
    payoutIntentId: h.intent.id,
    signature: SIGNATURE,
    slot: 123n
  });
  assert.equal(h.persisted, true);
  assert.equal(h.signerCalls, 1);
  assert.equal(h.broadcastCalls, 1);
  assert.equal(h.settlementCalls, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["signed", "submitted"],
    ["submitted", "finalized"]
  ]);
});

test("ambiguous broadcast preserves the original signature for reconciliation and never retries", async () => {
  const h = await fixture({ sendError: true });
  assert.deepEqual(h.result, {
    outcome: "reconciliation_required",
    payoutIntentId: h.intent.id,
    signature: SIGNATURE
  });
  assert.equal(h.persisted, true);
  assert.equal(h.signerCalls, 1);
  assert.equal(h.broadcastCalls, 1);
  assert.equal(h.settlementCalls, 0);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["signed", "reconciliation_required"]
  ]);
  assert.equal(h.transitions[0]?.evidence.broadcastOutcomeAmbiguous, true);
});

test("RPC signature mismatch quarantines payout before status or ledger settlement", async () => {
  const h = await fixture({ rpcSignature: "different-signature" });
  assert.equal(h.result.outcome, "quarantined");
  assert.equal(h.broadcastCalls, 1);
  assert.equal(h.settlementCalls, 0);
  assert.equal(h.transitions[0]?.to, "quarantined");
  assert.equal(h.transitions[0]?.evidence.integrityMismatch, true);
});

test("finalized transaction destination mismatch quarantines instead of paying", async () => {
  const transaction = {
    slot: 123,
    transaction: {
      signatures: [SIGNATURE],
      message: {
        recentBlockhash: BLOCKHASH,
        instructions: [{
          programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
          parsed: {
            type: "transferChecked",
            info: {
              source: "unexpected-source",
              destination: "unexpected-destination",
              authority: TREASURY_AUTHORITY,
              mint: MINT,
              amount: "100",
              decimals: 9
            }
          }
        }]
      }
    },
    meta: { err: null, innerInstructions: [] }
  };
  const h = await fixture({ finalizedTransaction: transaction });
  assert.equal(h.result.outcome, "quarantined");
  assert.equal(h.settlementCalls, 0);
  assert.equal(h.transitions.at(-1)?.to, "quarantined");
});

test("preflight simulation failure stops before signer, persistence and broadcast", async () => {
  const h = await fixture({ simulationError: { InstructionError: [0, "Custom"] } });
  assert.deepEqual(h.result, {
    outcome: "failed",
    payoutIntentId: h.intent.id,
    errorCode: "PAYOUT_SIMULATION_FAILED"
  });
  assert.equal(h.persisted, false);
  assert.equal(h.signerCalls, 0);
  assert.equal(h.broadcastCalls, 0);
  assert.equal(h.settlementCalls, 0);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["signing", "failed"]
  ]);
});

test("insufficient fee-payer SOL stops before signing and broadcast", async () => {
  const h = await fixture({ feePayerLamports: 1 });
  assert.deepEqual(h.result, {
    outcome: "failed",
    payoutIntentId: h.intent.id,
    errorCode: "PAYOUT_FEE_PAYER_INSUFFICIENT_SOL"
  });
  assert.equal(h.signerCalls, 0);
  assert.equal(h.broadcastCalls, 0);
  assert.equal(h.settlementCalls, 0);
});

test("ambiguous broadcast recovers the same signature to paid without a second signer or broadcast", async () => {
  const h = await fixture({ sendError: true });
  assert.equal(h.result.outcome, "reconciliation_required");
  assert.equal(h.signerCalls, 1);
  assert.equal(h.broadcastCalls, 1);

  const reconciliationRpc: BgDevnetPayoutReconciliationRpc = {
    getDevnetStatus: h.rpc.getDevnetStatus,
    getSignatureStatus: h.rpc.getSignatureStatus,
    getFinalizedBlockHeight: async () => 600,
    getFinalizedTransaction: h.rpc.getFinalizedTransaction,
    getSignatureHistoryEvidence: async () => ({ found: false, complete: false })
  };
  const recovered = await reconcileBgDevnetPayouts({
    config: { enabled: true, workerId: "e2e-recovery-worker" },
    repository: h.repository,
    rpc: reconciliationRpc
  });

  assert.equal(recovered.paid, 1);
  assert.equal(h.signerCalls, 1, "reconciliation must not request a replacement signature");
  assert.equal(h.broadcastCalls, 1, "reconciliation must never rebroadcast");
  assert.equal(h.settlementCalls, 1);
  assert.deepEqual(h.transitions.map((x) => [x.from, x.to]), [
    ["signed", "reconciliation_required"],
    ["reconciliation_required", "finalized"]
  ]);
});
