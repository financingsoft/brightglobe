import { z } from "zod";
import type { SolanaGateway } from "../blockchain/solana/gateway.js";
import type { SolanaRpcClient } from "../blockchain/solana/rpc-client.js";
import type {
  BgDevnetPayoutRpc,
  BgPayoutAccountSnapshot
} from "./bg-devnet-payout-executor.js";

const MAX_TRANSACTION_BYTES = 1_232;
const MAX_BASE64_TRANSACTION_LENGTH = Math.ceil(MAX_TRANSACTION_BYTES / 3) * 4;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const EXPECTED_PAYOUT_SIGNATURES = 2;

const balanceResponseSchema = z.object({
  context: z.object({ slot: z.number().int().nonnegative() }),
  value: z.number().int().nonnegative().refine(Number.isSafeInteger)
});

const feeResponseSchema = z.object({
  context: z.object({ slot: z.number().int().nonnegative() }),
  value: z.number().int().nonnegative().nullable().refine(
    (value) => value === null || Number.isSafeInteger(value)
  )
});

const simulationResponseSchema = z.object({
  value: z.object({ err: z.unknown().nullable() })
});

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeTransaction(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_BASE64_TRANSACTION_LENGTH ||
    value.length % 4 !== 0 ||
    !BASE64_PATTERN.test(value)
  ) {
    throw new TypeError("BG payout transaction is not bounded canonical base64.");
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new TypeError("BG payout transaction base64 could not be decoded.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (bytes.length === 0 || bytes.length > MAX_TRANSACTION_BYTES || encodeBase64(bytes) !== value) {
    throw new TypeError("BG payout transaction wire size or base64 encoding is invalid.");
  }
  return bytes;
}

function readShortVectorLength(bytes: Uint8Array): { value: number; nextOffset: number } {
  let value = 0;
  let multiplier = 1;
  for (let index = 0; index < 3; index += 1) {
    const byte = bytes[index];
    if (byte === undefined) throw new TypeError("BG payout transaction signature vector is truncated.");
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value, nextOffset: index + 1 };
    multiplier *= 128;
  }
  throw new TypeError("BG payout transaction signature vector is malformed.");
}

function inspectPayoutWireTransaction(value: string): {
  bytes: Uint8Array;
  signatureStart: number;
  messageStart: number;
} {
  const bytes = decodeTransaction(value);
  const vector = readShortVectorLength(bytes);
  if (vector.value !== EXPECTED_PAYOUT_SIGNATURES) {
    throw new TypeError("BG payout transaction must contain exactly two signer slots.");
  }

  const signatureStart = vector.nextOffset;
  const messageStart = signatureStart + vector.value * 64;
  if (messageStart >= bytes.length || bytes[messageStart] !== 0x80) {
    throw new TypeError("BG payout transaction must contain a version-0 Solana message.");
  }
  return { bytes, signatureStart, messageStart };
}

function assertUnsignedPayoutTransaction(value: string): string {
  const transaction = inspectPayoutWireTransaction(value);
  for (let index = transaction.signatureStart; index < transaction.messageStart; index += 1) {
    if (transaction.bytes[index] !== 0) {
      throw new TypeError("Fee estimation and simulation require an unsigned BG payout transaction.");
    }
  }
  return encodeBase64(transaction.bytes.slice(transaction.messageStart));
}

function assertSignedPayoutTransaction(value: string): void {
  const transaction = inspectPayoutWireTransaction(value);
  for (let offset = transaction.signatureStart; offset < transaction.messageStart; offset += 64) {
    let hasSignatureByte = false;
    for (let index = offset; index < offset + 64; index += 1) {
      if (transaction.bytes[index] !== 0) {
        hasSignatureByte = true;
        break;
      }
    }
    if (!hasSignatureByte) {
      throw new TypeError("Broadcast requires both BG payout signer slots to be populated.");
    }
  }
}

/**
 * Concrete Devnet RPC adapter for the payout executor.
 *
 * Reads use finalized account/balance data where available. Simulation is
 * explicitly unsigned and signature verification is disabled only for that
 * preflight call. Broadcast accepts only a bounded v0 transaction with both
 * signer slots populated and disables RPC-managed retries; ambiguous outcomes
 * are left to the separate read-only reconciler.
 */
export function createSolanaBgDevnetPayoutRpc(
  gateway: SolanaGateway,
  rpc: SolanaRpcClient
): BgDevnetPayoutRpc {
  return {
    async getDevnetStatus() {
      const status = await gateway.getDevnetStatus();
      return { healthy: status.healthy, genesisHash: status.genesisHash };
    },

    async getAccount(accountAddress): Promise<BgPayoutAccountSnapshot | null> {
      const response = await gateway.getAccountInfo(accountAddress, "finalized");
      if (!response.account) return null;
      return {
        owner: response.account.owner,
        dataBase64: response.account.data[0],
        executable: response.account.executable,
        lamports: response.account.lamports
      };
    },

    async getLamports(accountAddress) {
      const raw = await rpc.request<unknown>("getBalance", [
        accountAddress,
        { commitment: "finalized" }
      ]);
      return balanceResponseSchema.parse(raw).value;
    },

    async getMinimumBalanceForRentExemption(dataLength) {
      if (!Number.isInteger(dataLength) || dataLength < 1 || dataLength > 10_000_000) {
        throw new RangeError("BG payout rent-exemption data length is outside the supported range.");
      }
      const raw = await rpc.request<unknown>("getMinimumBalanceForRentExemption", [
        dataLength,
        { commitment: "finalized" }
      ]);
      const value = z.number().int().nonnegative().refine(Number.isSafeInteger).parse(raw);
      return value;
    },

    getLatestBlockhash() {
      return gateway.getLatestBlockhash("confirmed").then(({ blockhash, lastValidBlockHeight }) => ({
        blockhash,
        lastValidBlockHeight
      }));
    },

    async getFeeForTransaction(unsignedTransactionBase64) {
      const messageBase64 = assertUnsignedPayoutTransaction(unsignedTransactionBase64);
      const raw = await rpc.request<unknown>("getFeeForMessage", [
        messageBase64,
        { commitment: "confirmed" }
      ]);
      const fee = feeResponseSchema.parse(raw).value;
      if (fee === null) throw new Error("Solana RPC could not quote the BG payout message fee.");
      return fee;
    },

    async simulateTransaction(unsignedTransactionBase64) {
      assertUnsignedPayoutTransaction(unsignedTransactionBase64);
      const raw = await rpc.request<unknown>("simulateTransaction", [
        unsignedTransactionBase64,
        {
          encoding: "base64",
          commitment: "confirmed",
          sigVerify: false,
          replaceRecentBlockhash: false
        }
      ]);
      const parsed = simulationResponseSchema.parse(raw);
      return { err: parsed.value.err };
    },

    async sendRawTransaction(signedTransactionBase64) {
      assertSignedPayoutTransaction(signedTransactionBase64);
      const raw = await rpc.request<unknown>("sendTransaction", [
        signedTransactionBase64,
        {
          encoding: "base64",
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 0
        }
      ]);
      return z.string().min(1).max(100).parse(raw);
    },

    async getSignatureStatus(signature) {
      const response = await gateway.getSignatureStatuses([signature]);
      if (response.value.length !== 1) {
        throw new TypeError("Solana RPC returned an unexpected BG payout signature-status count.");
      }
      const item = response.value[0];
      if (!item) return { confirmationStatus: null, err: null, slot: null };
      return {
        confirmationStatus: item.confirmationStatus ?? null,
        err: item.err,
        slot: item.slot
      };
    },

    getFinalizedTransaction(signature) {
      return gateway.getTransaction(signature);
    }
  };
}
