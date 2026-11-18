import assert from "node:assert/strict";
import test from "node:test";
import { buildClassicSplTransferTransaction } from "./transfer-builder.js";

const SOURCE = "11111111111111111111111111111111";
const DESTINATION = "Vote111111111111111111111111111111111111111";
const MINT = "So11111111111111111111111111111111111111112";

test("builds an unsigned classic SPL TransferChecked transaction with a destination ATA", async () => {
  const transaction = await buildClassicSplTransferTransaction({
    feePayerAddress: SOURCE,
    sourceOwnerAddress: SOURCE,
    destinationOwnerAddress: DESTINATION,
    mintAddress: MINT,
    amountBaseUnits: 1500000n,
    decimals: 6,
    recentBlockhash: SOURCE,
    lastValidBlockHeight: 1234n
  });

  assert.ok(transaction.transactionBase64.length > 100);
  assert.ok(transaction.sourceTokenAccount.length >= 32);
  assert.ok(transaction.destinationTokenAccount.length >= 32);
  assert.notEqual(transaction.sourceTokenAccount, transaction.destinationTokenAccount);
});

test("rejects zero amounts and identical source and destination wallets", async () => {
  await assert.rejects(
    buildClassicSplTransferTransaction({
      feePayerAddress: SOURCE,
      sourceOwnerAddress: SOURCE,
      destinationOwnerAddress: DESTINATION,
      mintAddress: MINT,
      amountBaseUnits: 0n,
      decimals: 6,
      recentBlockhash: SOURCE,
      lastValidBlockHeight: 1234n
    }),
    /positive u64/
  );

  await assert.rejects(
    buildClassicSplTransferTransaction({
      feePayerAddress: SOURCE,
      sourceOwnerAddress: SOURCE,
      destinationOwnerAddress: SOURCE,
      mintAddress: MINT,
      amountBaseUnits: 1n,
      decimals: 6,
      recentBlockhash: SOURCE,
      lastValidBlockHeight: 1234n
    }),
    /must be different/
  );
});
