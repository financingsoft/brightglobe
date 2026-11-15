import { apiRequest } from "@/services/api";

export type BgAssetAccount = {
  assetCode: "BG";
  network: string;
  status: "draft" | "active" | "paused" | string;
  decimals: number | null;
  balanceBaseUnits: string;
};

export async function getBgAssetAccount(): Promise<BgAssetAccount> {
  return apiRequest<BgAssetAccount>("/api/v1/assets/BG/account");
}

export function formatAssetBaseUnits(value: string, decimals: number | null): string {
  if (!/^\d+$/.test(value) || decimals === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    return "—";
  }
  const amount = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}
