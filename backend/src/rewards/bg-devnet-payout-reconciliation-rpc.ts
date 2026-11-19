import type { SolanaGateway } from "../blockchain/solana/gateway.js";
import type { BgDevnetPayoutReconciliationRpc } from "./bg-devnet-payout-reconciler.js";

export interface SolanaBgPayoutReconciliationRpcConfig {
  /**
   * Set true only when the configured RPC provider contract guarantees complete
   * finalized transaction history for the fee-payer address.
   */
  archiveHistoryEnabled: boolean;
  maxHistoryPages?: number;
}

/**
 * Read-only adapter over the existing Solana gateway. It exposes no signing or
 * broadcast capability. Absence is authoritative only when archive coverage
 * is explicitly enabled and the address-history scan reaches its end.
 */
export function createSolanaBgPayoutReconciliationRpc(
  gateway: SolanaGateway,
  config: SolanaBgPayoutReconciliationRpcConfig
): BgDevnetPayoutReconciliationRpc {
  const maxHistoryPages = config.maxHistoryPages ?? 20;
  if (!Number.isInteger(maxHistoryPages) || maxHistoryPages < 1 || maxHistoryPages > 100) {
    throw new RangeError("BG payout archive history scan must use between 1 and 100 pages.");
  }

  return {
    async getDevnetStatus() {
      const status = await gateway.getDevnetStatus();
      return { healthy: status.healthy, genesisHash: status.genesisHash };
    },

    async getSignatureStatus(signature) {
      const response = await gateway.getSignatureStatuses([signature]);
      const item = response.value[0];
      if (!item) return { confirmationStatus: null, err: null, slot: null };
      return {
        confirmationStatus: item.confirmationStatus ?? null,
        err: item.err,
        slot: item.slot
      };
    },

    getFinalizedBlockHeight() {
      return gateway.getBlockHeight("finalized");
    },

    getFinalizedTransaction(signature) {
      return gateway.getTransaction(signature);
    },

    async getSignatureHistoryEvidence({ feePayerAddress, signature }) {
      let before: string | undefined;
      for (let pageNumber = 0; pageNumber < maxHistoryPages; pageNumber += 1) {
        const page = await gateway.getSignaturesForAddress(feePayerAddress, before, 1000);
        if (page.some((entry) => entry.signature === signature)) {
          return { found: true, complete: false };
        }
        if (page.length < 1000) {
          return { found: false, complete: config.archiveHistoryEnabled };
        }
        const oldest = page[page.length - 1];
        if (!oldest) return { found: false, complete: config.archiveHistoryEnabled };
        before = oldest.signature;
      }
      return { found: false, complete: false };
    }
  };
}
