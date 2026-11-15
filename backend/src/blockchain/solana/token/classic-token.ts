import { encodeBase58 } from "./base58.js";

export const CLASSIC_SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export class SplTokenAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplTokenAccountError";
  }
}

function decodeBase64(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new SplTokenAccountError("SPL Token account data is not valid base64.");
  }
}

function readU64(bytes: Uint8Array, offset: number): bigint {
  if (offset < 0 || offset + 8 > bytes.length) throw new SplTokenAccountError("SPL Token account data is truncated.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(offset, true);
}

function readU32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) throw new SplTokenAccountError("SPL Token account data is truncated.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(offset, true);
}

function readPublicKey(bytes: Uint8Array, offset: number): string {
  return encodeBase58(bytes.slice(offset, offset + 32));
}

export interface ParsedSplMint {
  mintAuthority: string | null;
  supplyBaseUnits: bigint;
  decimals: number;
  initialized: boolean;
  freezeAuthority: string | null;
}

export interface ParsedSplTokenAccount {
  mint: string;
  owner: string;
  amountBaseUnits: bigint;
  state: "uninitialized" | "initialized" | "frozen";
  delegatedAmount: bigint;
}

export function parseClassicSplMint(account: {
  owner: string;
  dataBase64: string;
}): ParsedSplMint {
  if (account.owner !== CLASSIC_SPL_TOKEN_PROGRAM_ID) {
    throw new SplTokenAccountError("The mint account is not owned by the classic SPL Token program.");
  }
  const bytes = decodeBase64(account.dataBase64);
  if (bytes.length !== 82) throw new SplTokenAccountError("Classic SPL Token mint data must be exactly 82 bytes.");

  const mintAuthorityOption = readU32(bytes, 0);
  const freezeAuthorityOption = readU32(bytes, 46);
  if (![0, 1].includes(mintAuthorityOption) || ![0, 1].includes(freezeAuthorityOption)) {
    throw new SplTokenAccountError("The mint authority option is invalid.");
  }
  if (bytes[45] !== 1) throw new SplTokenAccountError("The SPL Token mint is not initialized.");

  return {
    mintAuthority: mintAuthorityOption === 1 ? readPublicKey(bytes, 4) : null,
    supplyBaseUnits: readU64(bytes, 36),
    decimals: bytes[44]!,
    initialized: true,
    freezeAuthority: freezeAuthorityOption === 1 ? readPublicKey(bytes, 50) : null
  };
}

export function parseClassicSplTokenAccount(account: {
  owner: string;
  dataBase64: string;
}): ParsedSplTokenAccount {
  if (account.owner !== CLASSIC_SPL_TOKEN_PROGRAM_ID) {
    throw new SplTokenAccountError("The token account is not owned by the classic SPL Token program.");
  }
  const bytes = decodeBase64(account.dataBase64);
  if (bytes.length !== 165) throw new SplTokenAccountError("Classic SPL Token account data must be exactly 165 bytes.");

  const stateByte = bytes[108];
  if (stateByte !== 0 && stateByte !== 1 && stateByte !== 2) {
    throw new SplTokenAccountError("The token account state is invalid.");
  }
  const delegateOption = readU32(bytes, 72);
  if (delegateOption !== 0 && delegateOption !== 1) {
    throw new SplTokenAccountError("The token account delegate option is invalid.");
  }

  return {
    mint: readPublicKey(bytes, 0),
    owner: readPublicKey(bytes, 32),
    amountBaseUnits: readU64(bytes, 64),
    state: stateByte === 0 ? "uninitialized" : stateByte === 1 ? "initialized" : "frozen",
    delegatedAmount: readU64(bytes, 121)
  };
}

export function baseUnitsToDecimalString(amount: bigint, decimals: number): string {
  if (amount < 0n) throw new RangeError("Token amounts cannot be negative.");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new RangeError("Token decimals must be an integer from 0 to 255.");
  }
  if (decimals === 0) return amount.toString();
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function decimalStringToBaseUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new RangeError("Token decimals must be an integer from 0 to 255.");
  }
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) {
    throw new TypeError("Token amount must be a plain non-negative decimal string.");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    throw new RangeError("Token amount has more fractional digits than the mint supports.");
  }
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}
