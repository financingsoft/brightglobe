const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((char, index) => [char, BigInt(index)]));

export function decodeBase58(value: string, expectedLength?: number): Uint8Array | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) return null;
  let number = 0n;
  for (const char of value) {
    const digit = INDEX.get(char);
    if (digit === undefined) return null;
    number = number * 58n + digit;
  }
  const leadingZeroes = value.match(/^1*/)?.[0].length ?? 0;
  const decoded: number[] = [];
  while (number > 0n) {
    decoded.push(Number(number & 0xffn));
    number >>= 8n;
  }
  decoded.reverse();
  const output = new Uint8Array(leadingZeroes + decoded.length);
  output.set(decoded, leadingZeroes);
  if (expectedLength !== undefined && output.length !== expectedLength) return null;
  return output;
}
