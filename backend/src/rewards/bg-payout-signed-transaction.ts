import {
  address,
    getPublicKeyFromAddress,
  getSignatureFromTransaction,
  getTransactionDecoder,
  isFullySignedTransaction,
  isSignature,
  signatureBytes,
  verifySignature
} from "@solana/kit";

const MAX_SOLANA_TRANSACTION_BYTES = 1_232;

function equalBytes(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Independently verify that a signer returned the exact unsigned message we
 * approved, that every required Ed25519 signature is present and valid, and
 * that the advertised transaction signature is the actual fee-payer signature.
 *
 * This runs before the signature is persisted or any broadcast is attempted.
 * It never handles private key material.
 */
export async function verifyBgPayoutSignedTransaction(input: {
  unsignedTransactionBase64: string;
  signedTransactionBase64: string;
  transactionSignature: string;
  feePayerAddress: string;
  treasuryAuthorityAddress: string;
}): Promise<boolean> {
  try {
    if (
      !isSignature(input.transactionSignature) ||
      input.feePayerAddress === input.treasuryAuthorityAddress
    ) return false;

    const decoder = getTransactionDecoder();
    const unsignedBytes = decodeBase64(input.unsignedTransactionBase64);
    const signedBytes = decodeBase64(input.signedTransactionBase64);
    if (
      unsignedBytes.length === 0 ||
      signedBytes.length === 0 ||
      unsignedBytes.length > MAX_SOLANA_TRANSACTION_BYTES ||
      signedBytes.length > MAX_SOLANA_TRANSACTION_BYTES
    ) return false;

    const unsignedTransaction = decoder.decode(unsignedBytes);
    const signedTransaction = decoder.decode(signedBytes);
    if (!equalBytes(new Uint8Array(unsignedTransaction.messageBytes), new Uint8Array(signedTransaction.messageBytes))) {
      return false;
    }
    if (!isFullySignedTransaction(signedTransaction)) return false;

    const expectedSigners = new Set([
      input.feePayerAddress,
      input.treasuryAuthorityAddress
    ]);
    const signerEntries = Object.entries(signedTransaction.signatures);
    if (
      signerEntries.length !== expectedSigners.size ||
      signerEntries.some(([signerAddress]) => !expectedSigners.has(signerAddress))
    ) return false;

    if (getSignatureFromTransaction(signedTransaction) !== input.transactionSignature) {
      return false;
    }

    for (const [signerAddress, signature] of signerEntries) {
      if (signature === null) return false;
      const publicKey = await getPublicKeyFromAddress(address(signerAddress));
      if (!(await verifySignature(publicKey, signatureBytes(new Uint8Array(signature)), new Uint8Array(signedTransaction.messageBytes)))) {
        return false;
      }
    }
    return true;
  } catch {
    // Malformed wire transactions, invalid addresses, unsupported crypto
    // runtimes and invalid signatures all fail closed before persistence.
    return false;
  }
}
