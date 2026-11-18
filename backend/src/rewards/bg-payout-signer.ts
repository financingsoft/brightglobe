import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";
import { SOLANA_DEVNET_GENESIS_HASH } from "../blockchain/solana/gateway.js";
import { isValidSolanaAddress } from "../blockchain/solana/address.js";

const U64_MAX = 18_446_744_073_709_551_615n;
const MAX_SOLANA_TRANSACTION_BYTES = 1_232;
const MAX_BASE64_TRANSACTION_LENGTH = Math.ceil(MAX_SOLANA_TRANSACTION_BYTES / 3) * 4;

export type BgPayoutSignerProvider = "kms" | "hsm" | "external";

/**
 * Immutable constraints the signing service must independently enforce against
 * the decoded transaction message. This is deliberately Devnet-only.
 */
export interface BgPayoutSigningRequest {
  network: "devnet";
  genesisHash: string;
  signerProvider: BgPayoutSignerProvider;
  signerKeyReference: string;
  unsignedTransactionBase64: string;
  mintAddress: string;
  tokenProgram: string;
  sourceOwnerAddress: string;
  sourceTokenAccount: string;
  destinationOwnerAddress: string;
  destinationTokenAccount: string;
  feePayerAddress: string;
  amountBaseUnits: string;
  maxSinglePayoutBaseUnits: string;
  remainingRollingOutflowBaseUnits: string;
  decimals: number;
}

export interface BgPayoutSignedTransaction {
  signedTransactionBase64: string;
  transactionSignature: string;
}

/**
 * Provider adapters must enforce every supplied constraint by decoding the
 * transaction, not by trusting caller-supplied metadata. Implementations must
 * never return or log private key material.
 */
export interface BgPayoutSigner {
  readonly provider: BgPayoutSignerProvider;
  sign(request: BgPayoutSigningRequest): Promise<BgPayoutSignedTransaction>;
}

export class BgPayoutSigningPolicyError extends Error {
  constructor(readonly code: "NETWORK_NOT_ALLOWED" | "INVALID_SIGNING_POLICY" | "INVALID_TRANSACTION") {
    super("The BG payout signing request does not satisfy the Devnet signing policy.");
    this.name = "BgPayoutSigningPolicyError";
  }
}

function parsePositiveU64(value: string): bigint | null {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed <= U64_MAX ? parsed : null;
  } catch {
    return null;
  }
}

function isBoundedBase64(value: string): boolean {
  return value.length > 0 &&
    value.length <= MAX_BASE64_TRANSACTION_LENGTH &&
    value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

/**
 * Validate the application-side policy envelope before calling a signer.
 * This does not replace the signer's mandatory transaction-message inspection.
 */
export function validateBgPayoutSigningRequest(request: BgPayoutSigningRequest): void {
  if (request.network !== "devnet" || request.genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
    throw new BgPayoutSigningPolicyError("NETWORK_NOT_ALLOWED");
  }

  const amount = parsePositiveU64(request.amountBaseUnits);
  const maxSingle = parsePositiveU64(request.maxSinglePayoutBaseUnits);
  const remainingOutflow = parsePositiveU64(request.remainingRollingOutflowBaseUnits);
  const keyReference = request.signerKeyReference;

  if (
    (request.signerProvider !== "kms" && request.signerProvider !== "hsm" && request.signerProvider !== "external") ||
    typeof keyReference !== "string" ||
    keyReference.length < 6 ||
    keyReference.length > 256 ||
    !/^(kms|hsm|external):\/\/[A-Za-z0-9._:/-]+$/.test(keyReference) ||
    /private.?key|secret|seed.?phrase|mnemonic|-----BEGIN/i.test(keyReference) ||
    request.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID ||
    !isValidSolanaAddress(request.mintAddress) ||
    !isValidSolanaAddress(request.sourceOwnerAddress) ||
    !isValidSolanaAddress(request.sourceTokenAccount) ||
    !isValidSolanaAddress(request.destinationOwnerAddress) ||
    !isValidSolanaAddress(request.destinationTokenAccount) ||
    !isValidSolanaAddress(request.feePayerAddress) ||
    request.sourceOwnerAddress === request.destinationOwnerAddress ||
    request.sourceTokenAccount === request.destinationTokenAccount ||
    request.feePayerAddress === request.sourceOwnerAddress ||
    request.feePayerAddress === request.destinationOwnerAddress ||
    amount === null ||
    maxSingle === null ||
    remainingOutflow === null ||
    amount > maxSingle ||
    amount > remainingOutflow ||
    !Number.isInteger(request.decimals) ||
    request.decimals < 0 ||
    request.decimals > 18
  ) {
    throw new BgPayoutSigningPolicyError("INVALID_SIGNING_POLICY");
  }

  if (!isBoundedBase64(request.unsignedTransactionBase64)) {
    throw new BgPayoutSigningPolicyError("INVALID_TRANSACTION");
  }
}
