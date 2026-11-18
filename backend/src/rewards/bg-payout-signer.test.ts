import assert from "node:assert/strict";
import test from "node:test";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";
import {
  BgPayoutSigningPolicyError,
  validateBgPayoutSigningRequest,
  type BgPayoutSigningRequest
} from "./bg-payout-signer.js";

const VALID: BgPayoutSigningRequest = {
  network: "devnet",
  genesisHash: SOLANA_DEVNET_GENESIS_HASH,
  signerProvider: "kms",
  signerKeyReference: "kms://brightglobe/devnet/bg-reward",
  unsignedTransactionBase64: "AQ==",
  mintAddress: "So11111111111111111111111111111111111111112",
  tokenProgram: CLASSIC_SPL_TOKEN_PROGRAM_ID,
  sourceOwnerAddress: "11111111111111111111111111111111",
  sourceTokenAccount: "Vote111111111111111111111111111111111111111",
  destinationOwnerAddress: "Stake11111111111111111111111111111111111111",
  destinationTokenAccount: "SysvarRent111111111111111111111111111111111",
  feePayerAddress: "SysvarC1ock11111111111111111111111111111111",
  amountBaseUnits: "100",
  maxSinglePayoutBaseUnits: "1000",
  remainingRollingOutflowBaseUnits: "5000",
  decimals: 6
};

test("accepts a bounded Devnet Classic SPL signing policy", () => {
  assert.doesNotThrow(() => validateBgPayoutSigningRequest(VALID));
});

test("rejects Mainnet and a mismatched cluster genesis hash", () => {
  assert.throws(
    () => validateBgPayoutSigningRequest({ ...VALID, network: "mainnet-beta" } as unknown as BgPayoutSigningRequest),
    (error: unknown) => error instanceof BgPayoutSigningPolicyError && error.code === "NETWORK_NOT_ALLOWED"
  );
  assert.throws(
    () => validateBgPayoutSigningRequest({ ...VALID, genesisHash: "wrong" }),
    (error: unknown) => error instanceof BgPayoutSigningPolicyError && error.code === "NETWORK_NOT_ALLOWED"
  );
});

test("rejects non-Classic token programs and malformed addresses", () => {
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, tokenProgram: "TokenzQd..." }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, mintAddress: "not-an-address" }));
});

test("rejects amounts outside the single-payout or rolling outflow caps", () => {
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, amountBaseUnits: "1001" }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, amountBaseUnits: "5001" }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, amountBaseUnits: "0" }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, amountBaseUnits: "18446744073709551616" }));
});

test("rejects shared source and destination or fee payer identities", () => {
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, destinationOwnerAddress: VALID.sourceOwnerAddress }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, feePayerAddress: VALID.sourceOwnerAddress }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, destinationTokenAccount: VALID.sourceTokenAccount }));
});

test("rejects raw-key-like references and unsupported signer providers", () => {
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, signerKeyReference: "kms://private-key-material" }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, signerProvider: "devnet_local" as "kms" }));
});

test("rejects malformed or oversized unsigned transactions and invalid decimals", () => {
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, unsignedTransactionBase64: "not base64!" }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, unsignedTransactionBase64: "A".repeat(1648) }));
  assert.throws(() => validateBgPayoutSigningRequest({ ...VALID, decimals: 19 }));
});
