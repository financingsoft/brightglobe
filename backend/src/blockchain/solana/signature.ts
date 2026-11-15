import { decodeSolanaAddress } from "./address.js";

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy;
}

/**
 * Verifies a detached Ed25519 signature over the exact message bytes using
 * the 32-byte public key encoded by a Solana base58 wallet address.
 */
export async function verifySolanaMessageSignature(
  address: string,
  message: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  const publicKeyBytes = decodeSolanaAddress(address);
  if (!publicKeyBytes || signature.length !== 64) return false;

  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      toArrayBufferView(publicKeyBytes),
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      toArrayBufferView(signature),
      toArrayBufferView(message)
    );
  } catch {
    return false;
  }
}
