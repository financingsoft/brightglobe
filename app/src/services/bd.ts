import { apiRequest } from "@/services/api";

export type DailyCollectionStatus =
  | "available"
  | "claimed"
  | "not_configured"
  | "unavailable";

export type BdAccountSnapshot = {
  account: {
    assetCode: "BD";
    availableBaseUnits: string;
    pendingBaseUnits: string;
    lifetimeEarnedBaseUnits: string;
  };
  dailyCollection: {
    periodKey: string;
    status: DailyCollectionStatus;
    canClaim: boolean;
    claimed: boolean;
    rewardBaseUnits: string | null;
  };
  creditedBaseUnits?: string;
};

export type BdHistoryItem = {
  id: string;
  transactionId: string;
  type: string;
  deltaBaseUnits: string;
  createdAt: string;
};

export async function getBdAccount(): Promise<BdAccountSnapshot> {
  return apiRequest<BdAccountSnapshot>("/api/v1/me/bd");
}

export async function claimDailyCollection(): Promise<BdAccountSnapshot> {
  return apiRequest<BdAccountSnapshot>("/api/v1/me/bd/daily-collection", {
    method: "POST"
  });
}

export async function getBdHistory(): Promise<BdHistoryItem[]> {
  const response = await apiRequest<{ items: BdHistoryItem[] }>("/api/v1/me/bd/history");
  return response.items;
}

export function formatBdBaseUnits(value: string | null | undefined): string {
  if (!value || !/^-?\\d+$/.test(value)) return "0";
  const amount = BigInt(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / 1_000_000n;
  const fraction = (absolute % 1_000_000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  const result = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative ? `-${result}` : result;
}
