import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
import { buildClassicSplTransferTransaction } from "../blockchain/solana/transfer-builder.js";
import { verifyBgDevnetSignedTransaction } from "./bg-devnet-payout-service.js";

const DESTINATION = "Vote111111111111111111111111111111111111111";
const MINT = "So11111111111111111111111111111111111111112";
const BLOCKHASH = "11111111111111111111111111111111";

function encodeBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const byte of bytes) number = number * 256n + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    const remainder = Number(number % 58n);
    encoded = alphabet[remainder]! + encoded;
    number /= 58n;
  }
  const leadingZeroes = bytes.findIndex((byte) => byte !== 0);
  return "1".repeat(leadingZeroes === -1 ? bytes.length : leadingZeroes) + encoded;
}

function readShortVector(bytes: Uint8Array): { count: number; next: number } {
  let value = 0;
  let shift = 0;
  let offset = 0;
  for (let index = 0; index < 3; index += 1) {
    const byte = bytes[offset++]!;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { count: value, next: offset };
    shift += 7;
  }
  throw new Error("Invalid transaction signature vector.");
}

async function createKeypair() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { address: encodeBase58(publicKey), privateKey: pair.privateKey };
}

async function signWireTransaction(unsignedBase64: string, signers: Awaited<ReturnType<typeof createKeypair>>[]) {
  const unsigned = new Uint8Array(Buffer.from(unsignedBase64, "base64"));
  const count = readShortVector(unsigned);
  const messageOffset = count.next + count.count * 64;
  const message = unsigned.slice(messageOffset);
  const signatures = await Promise.all(signers.map(async (signer) =>
    new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, signer.privateKey, message))
  ));
  const totalLength = 1 + signatures.reduce((sum, signature) => sum + signature.length, 0) + message.length;
  const signed = new Uint8Array(totalLength);
  signed[0] = signatures.length;
  let offset = 1;
  for (const signature of signatures) {
    signed.set(signature, offset);
    offset += signature.length;
  }
  signed.set(message, offset);
  return Buffer.from(signed).toString("base64");
}

async function buildUnsigned(feePayerAddress: string, sourceOwnerAddress: string) {
  return buildClassicSplTransferTransaction({
    feePayerAddress,
    sourceOwnerAddress,
    destinationOwnerAddress: DESTINATION,
    mintAddress: MINT,
    amountBaseUnits: 1500n,
    decimals: 9,
    recentBlockhash: BLOCKHASH,
    lastValidBlockHeight: 1234n
  });
}

test("accepts a signer response only when all expected Devnet signers sign the unchanged message", async () => {
  const feePayer = await createKeypair();
  const treasury = await createKeypair();
  const unsigned = await buildUnsigned(feePayer.address, treasury.address);
  const signedTransactionBase64 = await signWireTransaction(unsigned.transactionBase64, [feePayer, treasury]);
  const result = await verifyBgDevnetSignedTransaction({
    unsignedTransactionBase64: unsigned.transactionBase64,
    signedTransactionBase64,
    requiredSigners: [feePayer.address, treasury.address]
  });
  assert.equal(result.signature.length >= 80, true);
});

test("rejects a signer response that changes the transfer message", async () => {
  const feePayer = await createKeypair();
  const treasury = await createKeypair();
  const unsigned = await buildUnsigned(feePayer.address, treasury.address);
  const bytes = new Uint8Array(Buffer.from(unsigned.transactionBase64, "base64"));
  const count = readShortVector(bytes);
  const messageOffset = count.next + count.count * 64;
  const changed = bytes.slice();
  changed[messageOffset + 8] = changed[messageOffset + 8]! ^ 1;
  const changedMessage = changed.slice(messageOffset);
  const signatures = await Promise.all([feePayer, treasury].map(async (signer) =>
    new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, signer.privateKey, changedMessage))
  ));
  const signed = new Uint8Array(1 + 128 + changedMessage.length);
  signed[0] = 2;
  signed.set(signatures[0]!, 1);
  signed.set(signatures[1]!, 65);
  signed.set(changedMessage, 129);
  await assert.rejects(
    verifyBgDevnetSignedTransaction({
      unsignedTransactionBase64: unsigned.transactionBase64,
      signedTransactionBase64: Buffer.from(signed).toString("base64"),
      requiredSigners: [feePayer.address, treasury.address]
    }),
    /identity mismatch/i
  );
});

test("rejects a missing, extra, or unexpected signer", async () => {
  const feePayer = await createKeypair();
  const treasury = await createKeypair();
  const other = await createKeypair();
  const unsigned = await buildUnsigned(feePayer.address, treasury.address);
  const signedTransactionBase64 = await signWireTransaction(unsigned.transactionBase64, [feePayer, treasury]);

  await assert.rejects(
    verifyBgDevnetSignedTransaction({
      unsignedTransactionBase64: unsigned.transactionBase64,
      signedTransactionBase64,
      requiredSigners: [feePayer.address]
    }),
    /signer count/i
  );
  await assert.rejects(
    verifyBgDevnetSignedTransaction({
      unsignedTransactionBase64: unsigned.transactionBase64,
      signedTransactionBase64,
      requiredSigners: [feePayer.address, treasury.address, other.address]
    }),
    /signer count/i
  );
  await assert.rejects(
    verifyBgDevnetSignedTransaction({
      unsignedTransactionBase64: unsigned.transactionBase64,
      signedTransactionBase64,
      requiredSigners: [feePayer.address, other.address]
    }),
    /signature invalid/i
  );
});
