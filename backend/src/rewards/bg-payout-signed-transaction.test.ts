import assert from "node:assert/strict";
import test from "node:test";
import {
  generateKeyPair,
  getAddressFromPublicKey,
  
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  getTransactionDecoder,
  signatureBytes,
  signTransaction
} from "@solana/kit";
import { buildClassicSplTransferTransaction } from "../blockchain/solana/transfer-builder.js";
import { verifyBgPayoutSignedTransaction } from "./bg-payout-signed-transaction.js";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const RECIPIENT = "Stake11111111111111111111111111111111111111";
const MINT = "So11111111111111111111111111111111111111112";
const BLOCKHASH = "11111111111111111111111111111111";

async function signedFixture() {
  const feePayerKeyPair = await generateKeyPair();
  const treasuryAuthorityKeyPair = await generateKeyPair();
  const feePayerAddress = await getAddressFromPublicKey(feePayerKeyPair.publicKey);
  const treasuryAuthorityAddress = await getAddressFromPublicKey(treasuryAuthorityKeyPair.publicKey);
  const built = await buildClassicSplTransferTransaction({
    feePayerAddress,
    treasuryAuthorityAddress,
    destinationOwnerAddress: RECIPIENT,
    mintAddress: MINT,
    amountBaseUnits: 100n,
    decimals: 9,
    recentBlockhash: BLOCKHASH,
    lastValidBlockHeight: 500n
  });
  const unsignedTransaction = getTransactionDecoder().decode(
    decodeBase64(built.transactionBase64)
  );
  const signedTransaction = await signTransaction(
    [feePayerKeyPair, treasuryAuthorityKeyPair],
    unsignedTransaction
  );
  return {
    feePayerAddress,
    treasuryAuthorityAddress,
    unsignedTransactionBase64: built.transactionBase64,
    signedTransactionBase64: getBase64EncodedWireTransaction(signedTransaction),
    transactionSignature: getSignatureFromTransaction(signedTransaction)
  };
}

test("accepts exact message with both valid Ed25519 signer signatures", async () => {
  const fixture = await signedFixture();
  assert.equal(await verifyBgPayoutSignedTransaction(fixture), true);
});

test("rejects a signed transaction whose message differs from the approved unsigned message", async () => {
  const fixture = await signedFixture();
  const changed = await buildClassicSplTransferTransaction({
    feePayerAddress: fixture.feePayerAddress,
    treasuryAuthorityAddress: fixture.treasuryAuthorityAddress,
    destinationOwnerAddress: RECIPIENT,
    mintAddress: MINT,
    amountBaseUnits: 101n,
    decimals: 9,
    recentBlockhash: BLOCKHASH,
    lastValidBlockHeight: 500n
  });
  assert.equal(await verifyBgPayoutSignedTransaction({
    ...fixture,
    unsignedTransactionBase64: changed.transactionBase64
  }), false);
});

test("rejects missing signatures and invalid transaction signature metadata", async () => {
  const fixture = await signedFixture();
  assert.equal(await verifyBgPayoutSignedTransaction({
    ...fixture,
    signedTransactionBase64: fixture.unsignedTransactionBase64
  }), false);
  assert.equal(await verifyBgPayoutSignedTransaction({
    ...fixture,
    transactionSignature: "not-a-solana-signature"
  }), false);
});

test("rejects a cryptographically corrupted signer signature", async () => {
  const fixture = await signedFixture();
  const decoded = getTransactionDecoder().decode(
    decodeBase64(fixture.signedTransactionBase64)
  );
  const originalSignature = decoded.signatures[fixture.feePayerAddress];
  assert.ok(originalSignature);
  const corruptedBytes = new Uint8Array(originalSignature);
  corruptedBytes[0] = corruptedBytes[0]! ^ 0xff;
  const corrupted = {
    ...decoded,
    signatures: {
      ...decoded.signatures,
      [fixture.feePayerAddress]: signatureBytes(corruptedBytes)
    }
  };
  assert.equal(await verifyBgPayoutSignedTransaction({
    ...fixture,
    signedTransactionBase64: getBase64EncodedWireTransaction(corrupted)
  }), false);
});

test("rejects a transaction signed for an unexpected treasury authority", async () => {
  const fixture = await signedFixture();
  const otherAuthority = await getAddressFromPublicKey((await generateKeyPair()).publicKey);
  assert.equal(await verifyBgPayoutSignedTransaction({
    ...fixture,
    treasuryAuthorityAddress: otherAuthority
  }), false);
});

test("rejects malformed base64 and over-sized wire transactions", async () => {
  const fixture = await signedFixture();
  assert.equal(await verifyBgPayoutSignedTransaction({
    ...fixture,
    signedTransactionBase64: "not-base64"
  }), false);
  assert.equal(await verifyBgPayoutSignedTransaction({
    ...fixture,
    signedTransactionBase64: "A".repeat(2_000)
  }), false);
});
