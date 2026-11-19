import assert from "node:assert/strict";
import test from "node:test";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { decodeSolanaAddress } from "../blockchain/solana/address.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";
import {
  reconcileBgTreasuryInventory,
  type BgTreasuryAccountForReconciliation,
  type BgTreasuryReconciliationRepository,
  type BgTreasuryReconciliationRpc,
  type BgTreasurySnapshotInput
} from "./bg-treasury-reconciler.js";

const MINT = "So11111111111111111111111111111111111111112";
const TREASURY = "Stake11111111111111111111111111111111111111";
const TOKEN_ACCOUNT = "11111111111111111111111111111111";

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function tokenAccountData(input: {
  mint?: string;
  owner?: string;
  amount?: bigint;
} = {}): string {
  const bytes = new Uint8Array(165);
  bytes.set(decodeSolanaAddress(input.mint ?? MINT)!, 0);
  bytes.set(decodeSolanaAddress(input.owner ?? TREASURY)!, 32);
  new DataView(bytes.buffer).setBigUint64(64, input.amount ?? 150n, true);
  bytes[108] = 1;
  return encodeBase64(bytes);
}

function mintData(decimals = 9): string {
  const bytes = new Uint8Array(82);
  bytes[44] = decimals;
  bytes[45] = 1;
  return encodeBase64(bytes);
}

function fixture(options: {
  balance?: bigint;
  reserved?: bigint;
  paid?: bigint;
  network?: string;
  tokenProgram?: string;
  tokenOwner?: string;
  tokenMint?: string;
  mintDecimals?: number;
  clusterHealthy?: boolean;
  genesisHash?: string;
  rpcError?: boolean;
  missingTokenAccount?: boolean;
  mintAccountOwner?: string;
  tokenAccountProgramOwner?: string;
} = {}) {
  const account: BgTreasuryAccountForReconciliation = {
    id: "treasury-1",
    network: options.network ?? "devnet",
    mintAddress: MINT,
    tokenProgram: options.tokenProgram ?? CLASSIC_SPL_TOKEN_PROGRAM_ID,
    treasuryWalletAddress: TREASURY,
    tokenAccountAddress: TOKEN_ACCOUNT,
    decimals: 9
  };
  const snapshots: BgTreasurySnapshotInput[] = [];
  let repositoryCalls = 0;
  const repository: BgTreasuryReconciliationRepository = {
    loadTreasuryAccount: async () => { repositoryCalls += 1; return account; },
    getInventoryTotals: async () => ({
      reservedBaseUnits: options.reserved ?? 100n,
      paidBaseUnits: options.paid ?? 25n
    }),
    recordSnapshot: async (snapshot) => {
      snapshots.push(snapshot);
      return { snapshotId: "snapshot-1", treasuryPaused: snapshot.status !== "matched" };
    }
  };
  let rpcCalls = 0;
  const rpc: BgTreasuryReconciliationRpc = {
    getDevnetStatus: async () => {
      rpcCalls += 1;
      if (options.rpcError) throw new Error("RPC unavailable");
      return {
        healthy: options.clusterHealthy ?? true,
        genesisHash: options.genesisHash ?? SOLANA_DEVNET_GENESIS_HASH
      };
    },
    getAccountInfo: async (address) => {
      rpcCalls += 1;
      if (options.rpcError) throw new Error("RPC unavailable");
      if (address === MINT) return {
        contextSlot: 500,
        account: {
          data: [mintData(options.mintDecimals ?? 9), "base64"],
          executable: false,
          lamports: 1_461_600,
          owner: options.mintAccountOwner ?? CLASSIC_SPL_TOKEN_PROGRAM_ID
        }
      };
      if (options.missingTokenAccount) return { contextSlot: 500, account: null };
      return {
        contextSlot: 501,
        account: {
          data: [tokenAccountData({
            amount: options.balance ?? 150n,
            owner: options.tokenOwner,
            mint: options.tokenMint
          }), "base64"],
          executable: false,
          lamports: 2_039_280,
          owner: options.tokenAccountProgramOwner ?? CLASSIC_SPL_TOKEN_PROGRAM_ID
        }
      };
    }
  };
  return { account, snapshots, repository, rpc, get repositoryCalls() { return repositoryCalls; }, get rpcCalls() { return rpcCalls; } };
}

test("disabled treasury reconciler does not read Neon or Solana", async () => {
  const h = fixture();
  const result = await reconcileBgTreasuryInventory({
    config: { enabled: false },
    treasuryAccountId: h.account.id,
    repository: h.repository,
    rpc: h.rpc
  });
  assert.deepEqual(result, { outcome: "disabled" });
  assert.equal(h.repositoryCalls, 0);
  assert.equal(h.rpcCalls, 0);
});

test("records matched finalized treasury inventory with reserved and paid totals", async () => {
  const h = fixture();
  const result = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: h.account.id,
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.outcome, "matched");
  assert.equal(result.snapshotId, "snapshot-1");
  assert.equal(result.reservedBaseUnits, 100n);
  assert.equal(result.paidBaseUnits, 25n);
  assert.equal(result.tokenBalanceBaseUnits, 150n);
  assert.equal(result.availableAfterReservationsBaseUnits, 50n);
  assert.equal(result.treasuryPaused, false);
  assert.equal(h.snapshots.length, 1);
  assert.equal(h.snapshots[0]?.observedSlot, 500n);
  assert.equal(h.snapshots[0]?.accountOwnerAddress, TREASURY);
});

test("insufficient on-chain inventory records a discrepancy and pauses the treasury", async () => {
  const h = fixture({ balance: 99n, reserved: 100n });
  const result = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: h.account.id,
    repository: h.repository,
    rpc: h.rpc
  });
  assert.equal(result.outcome, "insufficient_inventory");
  assert.equal(result.availableAfterReservationsBaseUnits, -1n);
  assert.equal(result.treasuryPaused, true);
  assert.equal(result.discrepancyCode, "treasury_balance_below_reserved_inventory");
});

test("wrong token-account owner or mint is quarantined", async () => {
  const wrongOwner = fixture({ tokenOwner: MINT });
  const ownerResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: wrongOwner.account.id,
    repository: wrongOwner.repository,
    rpc: wrongOwner.rpc
  });
  assert.equal(ownerResult.outcome, "quarantined");
  assert.equal(ownerResult.discrepancyCode, "treasury_token_identity_or_mint_mismatch");

  const wrongMint = fixture({ tokenMint: TREASURY });
  const mintResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: wrongMint.account.id,
    repository: wrongMint.repository,
    rpc: wrongMint.rpc
  });
  assert.equal(mintResult.outcome, "quarantined");
});

test("wrong SPL program owner and mint decimals are quarantined", async () => {
  const wrongProgram = fixture({ tokenAccountProgramOwner: TREASURY });
  const programResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: wrongProgram.account.id,
    repository: wrongProgram.repository,
    rpc: wrongProgram.rpc
  });
  assert.equal(programResult.outcome, "quarantined");

  const wrongDecimals = fixture({ mintDecimals: 8 });
  const decimalsResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: wrongDecimals.account.id,
    repository: wrongDecimals.repository,
    rpc: wrongDecimals.rpc
  });
  assert.equal(decimalsResult.outcome, "quarantined");
});

test("missing treasury token account and unsupported network are quarantined", async () => {
  const missing = fixture({ missingTokenAccount: true });
  const missingResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: missing.account.id,
    repository: missing.repository,
    rpc: missing.rpc
  });
  assert.equal(missingResult.outcome, "quarantined");

  const mainnet = fixture({ network: "mainnet-beta" });
  const mainnetResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: mainnet.account.id,
    repository: mainnet.repository,
    rpc: mainnet.rpc
  });
  assert.equal(mainnetResult.outcome, "quarantined");
  assert.equal(mainnet.rpcCalls, 0);
});

test("RPC outage or wrong Devnet genesis produces an unavailable snapshot and pauses", async () => {
  const outage = fixture({ rpcError: true });
  const outageResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: outage.account.id,
    repository: outage.repository,
    rpc: outage.rpc
  });
  assert.equal(outageResult.outcome, "unavailable");
  assert.equal(outageResult.treasuryPaused, true);

  const wrongCluster = fixture({ genesisHash: "not-devnet" });
  const clusterResult = await reconcileBgTreasuryInventory({
    config: { enabled: true },
    treasuryAccountId: wrongCluster.account.id,
    repository: wrongCluster.repository,
    rpc: wrongCluster.rpc
  });
  assert.equal(clusterResult.outcome, "unavailable");
});
