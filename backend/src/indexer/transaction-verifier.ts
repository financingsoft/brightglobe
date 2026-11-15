export interface TransferEventLike {
  eventType: string;
  slot: bigint;
  payload: Record<string, unknown>;
}

export interface TransferIntentExpectation {
  fromAddress: string;
  toAddress: string;
  amountBaseUnits: bigint;
  mintAddress: string;
  slot: bigint;
}

export function findMatchingFinalizedTransferEvent(
  events: readonly TransferEventLike[],
  expected: TransferIntentExpectation,
  sourceTokenAccounts: ReadonlySet<string>,
  destinationTokenAccounts: ReadonlySet<string>
): TransferEventLike | null {
  return events.find((event) => {
    const source = event.payload.source;
    const destination = event.payload.destination;
    const authority = event.payload.authority;
    const amount = event.payload.amountBaseUnits;
    const mint = event.payload.mint;

    return event.eventType === "transfer" &&
      event.slot === expected.slot &&
      typeof source === "string" && sourceTokenAccounts.has(source) &&
      typeof destination === "string" && destinationTokenAccounts.has(destination) &&
      authority === expected.fromAddress &&
      amount === expected.amountBaseUnits.toString() &&
      (mint === null || mint === undefined || mint === expected.mintAddress);
  }) ?? null;
}

export function matchesFinalizedTransferIntent(
  events: readonly TransferEventLike[],
  expected: TransferIntentExpectation,
  sourceTokenAccounts: ReadonlySet<string>,
  destinationTokenAccounts: ReadonlySet<string>
): boolean {
  return findMatchingFinalizedTransferEvent(events, expected, sourceTokenAccounts, destinationTokenAccounts) !== null;
}
