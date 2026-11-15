import { z } from "zod";
import { createSolanaRpcClient, type SolanaRpcClient } from "./rpc-client.js";

export const SOLANA_DEVNET_GENESIS_HASH = "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC";

const slotResponseSchema = z.object({
  context: z.object({ slot: z.number().int().nonnegative() }),
  value: z.number().int().nonnegative()
});

const accountInfoResponseSchema = z.object({
  context: z.object({ slot: z.number().int().nonnegative() }),
  value: z.object({
    data: z.tuple([z.string(), z.literal("base64")]),
    executable: z.boolean(),
    lamports: z.number().int().nonnegative(),
    owner: z.string(),
    rentEpoch: z.number().int().nonnegative()
  }).nullable()
});

export class SolanaClusterMismatchError extends Error {
  constructor(readonly expectedGenesisHash: string, readonly actualGenesisHash: string) {
    super("The configured Solana RPC endpoint is not connected to Devnet.");
    this.name = "SolanaClusterMismatchError";
  }
}

export interface SolanaGateway {
  getDevnetStatus(): Promise<{
    healthy: boolean;
    genesisHash: string;
    slot: number;
    blockHeight: number;
  }>;
  getAccountInfo(address: string, commitment?: "confirmed" | "finalized"): Promise<{
    contextSlot: number;
    account: {
      data: [string, "base64"];
      executable: boolean;
      lamports: number;
      owner: string;
      rentEpoch: number;
    } | null;
  }>;
  getLatestBlockhash(commitment?: "processed" | "confirmed" | "finalized"): Promise<{ blockhash: string; lastValidBlockHeight: number; contextSlot: number }>;
  getBlockHeight(commitment?: "processed" | "confirmed" | "finalized"): Promise<number>;
  getTransaction(signature: string): Promise<unknown | null>;
  getTokenAccountsByOwner(ownerAddress: string, mintAddress: string): Promise<Array<{ address: string; contextSlot: number }>>;
  getSignaturesForAddress(address: string, before?: string, limit?: number): Promise<Array<{
    signature: string;
    slot: number;
    err: unknown | null;
    confirmationStatus?: "processed" | "confirmed" | "finalized";
  }>>;
  getSignatureStatuses(signatures: readonly string[]): ReturnType<SolanaRpcClient["getSignatureStatuses"]>;
}

export function createSolanaGateway(
  endpoint: string,
  rpc: SolanaRpcClient = createSolanaRpcClient(endpoint)
): SolanaGateway {
  return {
    async getDevnetStatus() {
      const [health, genesisHash, slotValue, blockHeight] = await Promise.all([
        rpc.getHealth(),
        rpc.request<string>("getGenesisHash"),
        rpc.request<unknown>("getSlot", [{ commitment: "finalized" }]),
        rpc.request<unknown>("getBlockHeight", [{ commitment: "finalized" }])
      ]);

      if (genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
        throw new SolanaClusterMismatchError(SOLANA_DEVNET_GENESIS_HASH, genesisHash);
      }
      const slot = slotResponseSchema.parse(slotValue).value;
      if (typeof blockHeight !== "number" || !Number.isSafeInteger(blockHeight) || blockHeight < 0) {
        throw new TypeError("Solana RPC returned an invalid finalized block height.");
      }

      return {
        healthy: health === "ok",
        genesisHash,
        slot,
        blockHeight
      };
    },

    async getLatestBlockhash(commitment = "confirmed") {
      const raw = await rpc.getLatestBlockhash(commitment);
      if (
        !Number.isSafeInteger(raw.context.slot) || raw.context.slot < 0 ||
        !Number.isSafeInteger(raw.value.lastValidBlockHeight) || raw.value.lastValidBlockHeight < 0 ||
        typeof raw.value.blockhash !== "string" || raw.value.blockhash.length < 32 || raw.value.blockhash.length > 44
      ) {
        throw new TypeError("Solana RPC returned an invalid latest blockhash response.");
      }
      return {
        blockhash: raw.value.blockhash,
        lastValidBlockHeight: raw.value.lastValidBlockHeight,
        contextSlot: raw.context.slot
      };
    },

    async getBlockHeight(commitment = "confirmed") {
      const raw = await rpc.request<unknown>("getBlockHeight", [{ commitment }]);
      if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) {
        throw new TypeError("Solana RPC returned an invalid block height.");
      }
      return raw;
    },

    async getAccountInfo(address, commitment = "confirmed") {
      const raw = await rpc.request<unknown>("getAccountInfo", [
        address,
        { encoding: "base64", commitment }
      ]);
      const parsed = accountInfoResponseSchema.parse(raw);
      return { contextSlot: parsed.context.slot, account: parsed.value };
    },

    getTransaction(signature) {
      return rpc.request<unknown>("getTransaction", [
        signature,
        { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 }
      ]);
    },

    async getTokenAccountsByOwner(ownerAddress, mintAddress) {
      const response = await rpc.request<unknown>("getTokenAccountsByOwner", [ownerAddress, {
        mint: mintAddress,
        encoding: "jsonParsed",
        commitment: "finalized"
      }]);
      const parsed = z.object({
        context: z.object({ slot: z.number().int().nonnegative() }),
        value: z.array(z.object({ pubkey: z.string().min(32).max(44) }))
      }).parse(response);
      return parsed.value.map((account) => ({ address: account.pubkey, contextSlot: parsed.context.slot }));
    },

    async getSignaturesForAddress(address, before, limit = 1000) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new RangeError("Solana signature page size must be between 1 and 1000.");
      }
      const options: Record<string, unknown> = { commitment: "finalized", limit };
      if (before) options.before = before;
      const response = await rpc.request<unknown>("getSignaturesForAddress", [address, options]);
      return z.array(z.object({
        signature: z.string().min(1),
        slot: z.number().int().nonnegative(),
        err: z.unknown().nullable(),
        confirmationStatus: z.enum(["processed", "confirmed", "finalized"]).optional()
      })).parse(response);
    },

    async getSignatureStatuses(signatures) {
      const raw = await rpc.getSignatureStatuses(signatures, true);
      return z.object({
        context: z.object({ slot: z.number().int().nonnegative() }),
        value: z.array(z.object({
          slot: z.number().int().nonnegative(),
          confirmations: z.number().int().nonnegative().nullable(),
          err: z.unknown().nullable(),
          confirmationStatus: z.enum(["processed", "confirmed", "finalized"]).optional()
        }).nullable())
      }).parse(raw);
    }
  };
}
