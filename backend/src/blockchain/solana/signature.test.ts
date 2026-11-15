import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { verifySolanaMessageSignature } from "./signature.js";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = alphabet[remainder] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = "1" + encoded;
  }
  return encoded || "1";
}

async function createWallet() {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  );
  const publicKey = new Uint8Array(await webcrypto.subtle.exportKey("raw", keyPair.publicKey));
  return {
    address: encodeBase58(publicKey),
    sign: async (message: Uint8Array) =>
      new Uint8Array(await webcrypto.subtle.sign("Ed25519", keyPair.privateKey, message))
  };
}

test("verifies a valid Ed25519 wallet message signature", async () => {
  const wallet = await createWallet();
  const message = new TextEncoder().encode("BrightGlobe wallet ownership proof");
  const signature = await wallet.sign(message);

  assert.equal(await verifySolanaMessageSignature(wallet.address, message, signature), true);
});

test("rejects a signature made for a different message", async () => {
  const wallet = await createWallet();
  const signature = await wallet.sign(new TextEncoder().encode("original message"));

  assert.equal(
    await verifySolanaMessageSignature(
      wallet.address,
      new TextEncoder().encode("different message"),
      signature
    ),
    false
  );
});

test("rejects malformed addresses and signatures", async () => {
  const wallet = await createWallet();
  const message = new TextEncoder().encode("BrightGlobe");

  assert.equal(await verifySolanaMessageSignature("not-a-wallet", message, new Uint8Array(64)), false);
  assert.equal(await verifySolanaMessageSignature(wallet.address, message, new Uint8Array(63)), false);
});
