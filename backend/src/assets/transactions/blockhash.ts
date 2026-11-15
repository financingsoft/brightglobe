export function hasBlockhashExpired(currentBlockHeight: bigint, lastValidBlockHeight: bigint): boolean {
  if (currentBlockHeight < 0n || lastValidBlockHeight < 0n) {
    throw new RangeError("Solana block heights must be non-negative.");
  }
  return currentBlockHeight > lastValidBlockHeight;
}
