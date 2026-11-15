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


export function matchesFinalizedTransactionEnvelope(
  transaction: unknown,
  signature: string,
  recentBlockhash: string,
  expectedSlot: bigint
): boolean {
  if (typeof transaction !== "object" || transaction === null || Array.isArray(transaction)) return false;
  const root = transaction as Record<string, unknown>;
  const tx = root.transaction;
  if (typeof tx !== "object" || tx === null || Array.isArray(tx)) return false;
  const txRecord = tx as Record<string, unknown>;
  const message = txRecord.message;
  if (typeof message !== "object" || message === null || Array.isArray(message)) return false;
  const messageRecord = message as Record<string, unknown>;
  const signatures = txRecord.signatures;
  if (!Array.isArray(signatures) || typeof signatures[0] !== "string") return false;
  if (typeof root.slot !== "number" || !Number.isSafeInteger(root.slot) || root.slot < 0) return false;

  return signatures[0] === signature &&
    messageRecord.recentBlockhash === recentBlockhash &&
    BigInt(root.slot) === expectedSlot;
}
