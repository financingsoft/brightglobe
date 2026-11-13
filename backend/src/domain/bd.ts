export const BD_ASSET_CODE = "BD";
export const BD_DECIMALS = 6;
export const BD_BASE_UNITS_PER_UNIT = 1_000_000n;

export function getUtcPeriodKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required.");
  }
  return date.toISOString().slice(0, 10);
}

export function getDailyCollectionEventKey(userId: string, periodKey: string): string {
  if (!userId.trim()) throw new Error("A user ID is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
    throw new Error("The period key must use YYYY-MM-DD.");
  }
  return `daily-collection:${userId}:${periodKey}`;
}

export function formatBdBaseUnits(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / BD_BASE_UNITS_PER_UNIT;
  const fraction = (absolute % BD_BASE_UNITS_PER_UNIT)
    .toString()
    .padStart(BD_DECIMALS, "0")
    .replace(/0+$/, "");
  const formatted = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative ? `-${formatted}` : formatted;
}
