const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(
  [...BASE58_ALPHABET].map((character, index) => [character, BigInt(index)])
);

/**
 * Decodes a Solana base58 public key into its 32 raw bytes.
 * Returns null for invalid base58 strings or values that are not exactly 32 bytes.
 */
export function decodeSolanaAddress(address: string): Uint8Array | null {
  if (typeof address !== "string" || address.length < 32 || address.length > 44) {
    return null;
  }

  let value = 0n;
  for (const character of address) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return null;
    value = value * 58n + digit;
  }

  const leadingZeroes = address.match(/^1*/)?.[0].length ?? 0;
  const decoded: number[] = [];
  while (value > 0n) {
    decoded.push(Number(value & 0xffn));
    value >>= 8n;
  }
  decoded.reverse();

  const bytes = new Uint8Array(leadingZeroes + decoded.length);
  bytes.set(decoded, leadingZeroes);
  return bytes.length === 32 ? bytes : null;
}

export function isValidSolanaAddress(address: string): boolean {
  return decodeSolanaAddress(address) !== null;
}
