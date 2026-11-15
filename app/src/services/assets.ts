import { apiRequest } from "@/services/api";

export type BgAssetAccount = {
  assetCode: "BG";
  network: string;
  status: "draft" | "active" | "paused" | string;
  decimals: number | null;
  balanceBaseUnits: string;
  reservedBaseUnits?: string;
  spendableBaseUnits?: string;
};

export type BgOnChainWalletBalance = {
  assetCode: "BG";
  network: "devnet";
  ownerAddress: string;
  mintAddress: string;
  decimals: number;
  tokenAccountAddress: string;
  tokenAccountExists: boolean;
  accountState?: "initialized" | "frozen";
  onChainBalanceBaseUnits: string;
  commitment: "finalized";
  slot?: string;
};

export async function getBgOnChainWalletBalance(
  ownerAddress: string
): Promise<BgOnChainWalletBalance> {
  return apiRequest<BgOnChainWalletBalance>(
    "/api/v1/assets/BG/wallet/" + encodeURIComponent(ownerAddress)
  );
}

export type BgAssetTransactionStatus =
  | "created"
  | "signed"
  | "submitted"
  | "confirmed"
  | "finalized"
  | "failed"
  | "expired";

export type BgTransferIntent = {
  intentId: string;
  replayed: boolean;
  recentBlockhash: string;
  lastValidBlockHeight: string;
  status: "created";
  mintAddress: string;
  decimals: number;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
  transactionBase64: string;
};

export type BgAssetTransactionSnapshot = {
  id: string;
  assetId: string;
  operation: string;
  amountBaseUnits: string;
  status: BgAssetTransactionStatus;
  chainSignature: string | null;
  recentBlockhash: string | null;
  lastValidBlockHeight: string | null;
  chainSlot: string | null;
  chainCommitment: "processed" | "confirmed" | "finalized" | null;
  ledgerSettled: boolean;
  ledgerPostedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getBgAssetAccount(): Promise<BgAssetAccount> {
  return apiRequest<BgAssetAccount>("/api/v1/assets/BG/account");
}

export async function createBgTransferIntent(input: {
  fromAddress: string;
  toAddress: string;
  amountBaseUnits: string;
  idempotencyKey: string;
}): Promise<BgTransferIntent> {
  return apiRequest<BgTransferIntent>("/api/v1/assets/BG/transactions", {
    method: "POST",
    body: JSON.stringify({
      operation: "transfer",
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      amountBaseUnits: input.amountBaseUnits,
      idempotencyKey: input.idempotencyKey
    })
  });
}

export async function reportBgTransferSubmitted(
  intentId: string,
  signature: string
): Promise<{ id: string; status: string; chainSignature: string; note?: string }> {
  return apiRequest<{ id: string; status: string; chainSignature: string; note?: string }>("/api/v1/assets/transactions/" + encodeURIComponent(intentId) + "/submitted", {
    method: "POST",
    body: JSON.stringify({ signature })
  });
}

export async function getBgAssetTransaction(
  intentId: string
): Promise<BgAssetTransactionSnapshot> {
  return apiRequest<BgAssetTransactionSnapshot>(
    "/api/v1/assets/transactions/" + encodeURIComponent(intentId)
  );
}

export function decimalStringToAssetBaseUnits(value: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RangeError("Token decimals must be an integer between 0 and 18.");
  }
  const normalized = value.trim();
  if (!/^(0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(normalized)) {
    throw new TypeError("Enter a positive decimal token amount.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    throw new RangeError("This asset supports at most " + decimals + " decimal places.");
  }
  const amount = BigInt(whole!) * (10n ** BigInt(decimals)) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (amount <= 0n || amount > 18446744073709551615n) {
    throw new RangeError("The transfer amount must be a positive u64 value.");
  }
  return amount.toString();
}

export function formatAssetBaseUnits(value: string, decimals: number | null): string {
  if (!/^\d+$/.test(value) || decimals === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    return "—";
  }
  const amount = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction : whole.toString();
}
