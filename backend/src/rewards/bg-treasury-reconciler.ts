import {
  CLASSIC_SPL_TOKEN_PROGRAM_ID,
  parseClassicSplMint,
  parseClassicSplTokenAccount
} from "../blockchain/solana/token/classic-token.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";

export interface BgTreasuryAccountForReconciliation {
  id: string;
  network: string;
  mintAddress: string | null;
  tokenProgram: string;
  treasuryWalletAddress: string | null;
  tokenAccountAddress: string | null;
  decimals: number | null;
}

export interface BgTreasuryInventoryTotals {
  reservedBaseUnits: bigint;
  paidBaseUnits: bigint;
}

export type BgTreasuryReconciliationStatus =
  | "matched"
  | "insufficient_inventory"
  | "quarantined"
  | "unavailable";

export interface BgTreasurySnapshotInput {
  treasuryAccountId: string;
  network: string;
  mintAddress: string;
  tokenProgram: string;
  tokenAccountAddress: string;
  accountOwnerAddress: string | null;
  accountMintAddress: string | null;
  accountState: "uninitialized" | "initialized" | "frozen" | null;
  observedSlot: bigint | null;
  tokenBalanceBaseUnits: bigint | null;
  reservedBaseUnits: bigint;
  paidBaseUnits: bigint;
  availableAfterReservationsBaseUnits: bigint | null;
  status: BgTreasuryReconciliationStatus;
  discrepancyCode: string | null;
  evidence: Record<string, unknown>;
}

export interface BgTreasuryReconciliationRepository {
  loadTreasuryAccount(treasuryAccountId: string): Promise<BgTreasuryAccountForReconciliation | null>;
  getInventoryTotals(treasuryAccountId: string): Promise<BgTreasuryInventoryTotals>;
  recordSnapshot(snapshot: BgTreasurySnapshotInput): Promise<{ snapshotId: string; treasuryPaused: boolean }>;
}

export interface BgTreasuryReconciliationRpc {
  getDevnetStatus(): Promise<{ healthy: boolean; genesisHash: string }>;
  getAccountInfo(
    address: string,
    commitment: "finalized"
  ): Promise<{
    contextSlot: number;
    account: {
      data: [string, "base64"];
      executable: boolean;
      lamports: number;
      owner: string;
    } | null;
  }>;
}

export interface BgTreasuryReconcilerConfig {
  enabled: boolean;
}

export type BgTreasuryReconciliationResult =
  | { outcome: "disabled" }
  | { outcome: "not_found" }
  | {
      outcome: BgTreasuryReconciliationStatus;
      snapshotId: string;
      treasuryPaused: boolean;
      reservedBaseUnits: bigint;
      paidBaseUnits: bigint;
      tokenBalanceBaseUnits: bigint | null;
      availableAfterReservationsBaseUnits: bigint | null;
      discrepancyCode: string | null;
    };

function emptySnapshot(
  account: BgTreasuryAccountForReconciliation,
  totals: BgTreasuryInventoryTotals,
  discrepancyCode: string,
  status: BgTreasuryReconciliationStatus
): BgTreasurySnapshotInput {
  return {
    treasuryAccountId: account.id,
    network: account.network,
    mintAddress: account.mintAddress ?? "unconfigured",
    tokenProgram: account.tokenProgram,
    tokenAccountAddress: account.tokenAccountAddress ?? "unconfigured",
    accountOwnerAddress: null,
    accountMintAddress: null,
    accountState: null,
    observedSlot: null,
    tokenBalanceBaseUnits: null,
    reservedBaseUnits: totals.reservedBaseUnits,
    paidBaseUnits: totals.paidBaseUnits,
    availableAfterReservationsBaseUnits: null,
    status,
    discrepancyCode,
    evidence: { readOnly: true }
  };
}

/**
 * Read-only Devnet treasury inventory reconciliation.
 *
 * It never signs, sends, creates transactions or resumes a paused treasury.
 * Any non-matched result is durably snapshotted and pauses an active treasury.
 */
export async function reconcileBgTreasuryInventory(input: {
  config: BgTreasuryReconcilerConfig;
  treasuryAccountId: string;
  repository: BgTreasuryReconciliationRepository;
  rpc: BgTreasuryReconciliationRpc;
}): Promise<BgTreasuryReconciliationResult> {
  if (!input.config.enabled) return { outcome: "disabled" };
  const account = await input.repository.loadTreasuryAccount(input.treasuryAccountId);
  if (!account) return { outcome: "not_found" };
  const totals = await input.repository.getInventoryTotals(account.id);

  let snapshot: BgTreasurySnapshotInput;
  if (
    account.network !== "devnet" ||
    account.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
    !account.mintAddress ||
    !account.treasuryWalletAddress ||
    !account.tokenAccountAddress ||
    account.decimals === null ||
    !Number.isInteger(account.decimals) ||
    account.decimals < 0 ||
    account.decimals > 18
  ) {
    snapshot = emptySnapshot(account, totals, "treasury_configuration_incomplete_or_unsupported", "quarantined");
  } else {
    try {
      const cluster = await input.rpc.getDevnetStatus();
      if (!cluster.healthy || cluster.genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
        snapshot = emptySnapshot(account, totals, "devnet_cluster_unavailable_or_mismatched", "unavailable");
      } else {
        const [mintResponse, tokenResponse] = await Promise.all([
          input.rpc.getAccountInfo(account.mintAddress, "finalized"),
          input.rpc.getAccountInfo(account.tokenAccountAddress, "finalized")
        ]);
        if (!mintResponse.account || mintResponse.account.executable || !tokenResponse.account ||
            tokenResponse.account.executable) {
          snapshot = emptySnapshot(account, totals, "treasury_mint_or_token_account_missing", "quarantined");
        } else {
          const parsed = (() => {
            try {
              return {
                mint: parseClassicSplMint({
                  owner: mintResponse.account!.owner,
                  dataBase64: mintResponse.account!.data[0]
                }),
                token: parseClassicSplTokenAccount({
                  owner: tokenResponse.account!.owner,
                  dataBase64: tokenResponse.account!.data[0]
                })
              };
            } catch {
              return null;
            }
          })();
          if (!parsed) {
            snapshot = {
              ...emptySnapshot(account, totals, "treasury_account_program_owner_or_data_invalid", "quarantined"),
              observedSlot: BigInt(Math.min(mintResponse.contextSlot, tokenResponse.contextSlot)),
              evidence: {
                mintAccountProgramOwner: mintResponse.account.owner,
                tokenAccountProgramOwner: tokenResponse.account.owner,
                finalizedAccountRead: true
              }
            };
          } else {
            const { mint, token } = parsed;
            const observedSlot = BigInt(Math.min(mintResponse.contextSlot, tokenResponse.contextSlot));
            const available = token.amountBaseUnits - totals.reservedBaseUnits;
            const identityMatches =
              mint.initialized &&
              mint.decimals === account.decimals &&
              token.mint === account.mintAddress &&
              token.owner === account.treasuryWalletAddress &&
              token.state === "initialized";
            if (!identityMatches) {
              snapshot = {
                ...emptySnapshot(account, totals, "treasury_token_identity_or_mint_mismatch", "quarantined"),
                accountOwnerAddress: token.owner,
                accountMintAddress: token.mint,
                accountState: token.state,
                observedSlot,
                tokenBalanceBaseUnits: token.amountBaseUnits,
                availableAfterReservationsBaseUnits: available,
                evidence: {
                  mintDecimals: mint.decimals,
                  configuredDecimals: account.decimals,
                  mintAccountProgramOwner: mintResponse.account.owner,
                  tokenAccountProgramOwner: tokenResponse.account.owner
                }
              };
            } else if (available < 0n) {
              snapshot = {
                ...emptySnapshot(account, totals, "treasury_balance_below_reserved_inventory", "insufficient_inventory"),
                accountOwnerAddress: token.owner,
                accountMintAddress: token.mint,
                accountState: token.state,
                observedSlot,
                tokenBalanceBaseUnits: token.amountBaseUnits,
                availableAfterReservationsBaseUnits: available,
                evidence: {
                  finalizedAccountRead: true,
                  mintAccountProgramOwner: mintResponse.account.owner,
                  tokenAccountProgramOwner: tokenResponse.account.owner
                }
              };
            } else {
              snapshot = {
                ...emptySnapshot(account, totals, "", "unavailable"),
                accountOwnerAddress: token.owner,
                accountMintAddress: token.mint,
                accountState: token.state,
                observedSlot,
                tokenBalanceBaseUnits: token.amountBaseUnits,
                availableAfterReservationsBaseUnits: available,
                status: "matched",
                discrepancyCode: null,
                evidence: {
                  finalizedAccountRead: true,
                  mintDecimals: mint.decimals,
                  mintAccountProgramOwner: mintResponse.account.owner,
                  tokenAccountProgramOwner: tokenResponse.account.owner
                }
              };
            }
          }
        }
      }
    } catch {
      snapshot = emptySnapshot(account, totals, "treasury_rpc_or_account_decode_failed", "unavailable");
    }
  }

  const recorded = await input.repository.recordSnapshot(snapshot);
  return {
    outcome: snapshot.status,
    snapshotId: recorded.snapshotId,
    treasuryPaused: recorded.treasuryPaused,
    reservedBaseUnits: snapshot.reservedBaseUnits,
    paidBaseUnits: snapshot.paidBaseUnits,
    tokenBalanceBaseUnits: snapshot.tokenBalanceBaseUnits,
    availableAfterReservationsBaseUnits: snapshot.availableAfterReservationsBaseUnits,
    discrepancyCode: snapshot.discrepancyCode
  };
}
