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

  const historyByAddress = new Map<string, {
    signatures: Set<string>;
    before: string | undefined;
    pagesScanned: number;
    reachedEnd: boolean;
  }>();

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
      let state = historyByAddress.get(feePayerAddress);
      if (!state) {
        state = { signatures: new Set<string>(), before: undefined, pagesScanned: 0, reachedEnd: false };
        historyByAddress.set(feePayerAddress, state);
      }

      while (
        !state.signatures.has(signature) &&
        !state.reachedEnd &&
        state.pagesScanned < maxHistoryPages
      ) {
        const page = await gateway.getSignaturesForAddress(feePayerAddress, state.before, 1000);
        state.pagesScanned += 1;
        for (const entry of page) state.signatures.add(entry.signature);

        if (page.length < 1000) {
          state.reachedEnd = true;
          break;
        }
        const oldest = page[page.length - 1];
        if (!oldest) {
          state.reachedEnd = true;
          break;
        }
        state.before = oldest.signature;
      }

      return {
        found: state.signatures.has(signature),
        complete: state.reachedEnd && config.archiveHistoryEnabled
      };
    }
  };
}
