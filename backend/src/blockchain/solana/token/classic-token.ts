import {
  TOKEN_PROGRAM_ADDRESS,
  AccountState,
  getMintDecoder,
  getTokenDecoder
} from "@solana-program/token";

export const CLASSIC_SPL_TOKEN_PROGRAM_ID = TOKEN_PROGRAM_ADDRESS;

const MINT_ACCOUNT_SIZE = 82;
const TOKEN_ACCOUNT_SIZE = 165;
const U64_MAX = 18446744073709551615n;

export class SplTokenAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplTokenAccountError";
  }
}

export interface ParsedSplMint {
  mintAuthority: string | null;
  supplyBaseUnits: bigint;
  /** Backwards-compatible alias for supplyBaseUnits. */
  supply: bigint;
  decimals: number;
  initialized: boolean;
  freezeAuthority: string | null;
}

export interface ParsedSplTokenAccount {
  mint: string;
  owner: string;
  amountBaseUnits: bigint;
  /** Backwards-compatible alias for amountBaseUnits. */
  amount: bigint;
  state: "uninitialized" | "initialized" | "frozen";
  delegatedAmount: bigint;
}

function decodeBase64(value: string): Uint8Array {
  if (typeof value !== "string" || value.length === 0) {
    throw new SplTokenAccountError("SPL Token account data is empty.");
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new SplTokenAccountError("SPL Token account data is not valid base64.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function readOptionalAddress(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "__option" in value &&
    (value as { __option?: unknown }).__option === "Some" &&
    "value" in value &&
    typeof (value as { value?: unknown }).value === "string"
  ) {
    return (value as { value: string }).value;
  }
  return null;
}

/**
 * Decode a classic SPL Mint using the official generated Token Program client.
 * The explicit owner/size and initialization checks remain BrightGlobe's
 * application boundary. Large integer supplies are always represented as
 * bigint base units, never floating-point values.
 */
export function parseClassicSplMint(input: {
  owner: string;
  dataBase64: string;
}): ParsedSplMint {
  if (input.owner !== CLASSIC_SPL_TOKEN_PROGRAM_ID) {
    throw new SplTokenAccountError("Mint account is not owned by the classic SPL Token program.");
  }
  const bytes = decodeBase64(input.dataBase64);
  if (bytes.byteLength !== MINT_ACCOUNT_SIZE) {
    throw new SplTokenAccountError("Classic SPL Mint account must be exactly 82 bytes.");
  }

  let mint;
  try {
    mint = getMintDecoder().decode(bytes);
  } catch {
    throw new SplTokenAccountError("Classic SPL Mint account data is malformed.");
  }
  if (!mint.isInitialized) {
    throw new SplTokenAccountError("Classic SPL Mint is not initialized.");
  }

  return {
    mintAuthority: readOptionalAddress(mint.mintAuthority),
    supplyBaseUnits: mint.supply,
    supply: mint.supply,
    decimals: mint.decimals,
    initialized: mint.isInitialized,
    freezeAuthority: readOptionalAddress(mint.freezeAuthority)
  };
}

/**
 * Decode a classic SPL token account using the official generated Token
 * Program client. Amounts remain bigint base units; no floating point is used.
 */
export function parseClassicSplTokenAccount(input: {
  owner: string;
  dataBase64: string;
}): ParsedSplTokenAccount {
  if (input.owner !== CLASSIC_SPL_TOKEN_PROGRAM_ID) {
    throw new SplTokenAccountError("Token account is not owned by the classic SPL Token program.");
  }
  const bytes = decodeBase64(input.dataBase64);
  if (bytes.byteLength !== TOKEN_ACCOUNT_SIZE) {
    throw new SplTokenAccountError("Classic SPL Token account must be exactly 165 bytes.");
  }

  let tokenAccount;
  try {
    tokenAccount = getTokenDecoder().decode(bytes);
  } catch {
    throw new SplTokenAccountError("Classic SPL Token account data is malformed.");
  }
  const state = tokenAccount.state === AccountState.Initialized
    ? "initialized"
    : tokenAccount.state === AccountState.Frozen
      ? "frozen"
      : "uninitialized";

  return {
    mint: tokenAccount.mint,
    owner: tokenAccount.owner,
    amountBaseUnits: tokenAccount.amount,
    amount: tokenAccount.amount,
    state,
    delegatedAmount: tokenAccount.delegatedAmount
  };
}

export function baseUnitsToDecimalString(amount: bigint, decimals: number): string {
  if (amount < 0n || amount > U64_MAX) throw new RangeError("Token amount is outside the u64 range.");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RangeError("Token decimals must be an integer between 0 and 18.");
  }
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction : whole.toString();
}

export function decimalStringToBaseUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RangeError("Token decimals must be an integer between 0 and 18.");
  }
  const normalized = value.trim();
  if (!/^(0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(normalized)) {
    throw new TypeError("Token amount must be a decimal string.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    throw new RangeError("Token amount has too many fractional digits.");
  }
  const amount = BigInt(whole!) * (10n ** BigInt(decimals)) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (amount > U64_MAX) throw new RangeError("Token amount exceeds the classic SPL Token u64 limit.");
  return amount;
}
