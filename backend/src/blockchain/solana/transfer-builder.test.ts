import assert from "node:assert/strict";
import test from "node:test";
import { buildClassicSplTransferTransaction } from "./transfer-builder.js";

const FEE_PAYER = "11111111111111111111111111111111";
const TREASURY_AUTHORITY = "Vote111111111111111111111111111111111111111";
const RECIPIENT = "Stake11111111111111111111111111111111111111";
const MINT = "So11111111111111111111111111111111111111112";

const validInput = {
  feePayerAddress: FEE_PAYER,
  treasuryAuthorityAddress: TREASURY_AUTHORITY,
  destinationOwnerAddress: RECIPIENT,
  mintAddress: MINT,
  amountBaseUnits: 1500000n,
  decimals: 6,
  recentBlockhash: FEE_PAYER,
  lastValidBlockHeight: 1234n
};

test("builds unsigned TransferChecked with separate fee payer and treasury authority", async () => {
  const transaction = await buildClassicSplTransferTransaction(validInput);

  assert.ok(transaction.transactionBase64.length > 100);
  assert.ok(transaction.sourceTokenAccount.length >= 32);
  assert.ok(transaction.destinationTokenAccount.length >= 32);
  assert.notEqual(transaction.sourceTokenAccount, transaction.destinationTokenAccount);
  assert.equal(transaction.feePayerAddress, FEE_PAYER);
  assert.equal(transaction.treasuryAuthorityAddress, TREASURY_AUTHORITY);
});

test("rejects any overlap between fee payer, treasury authority and recipient", async () => {
  await assert.rejects(
    buildClassicSplTransferTransaction({
      ...validInput,
      feePayerAddress: TREASURY_AUTHORITY
    }),
    /three different wallets/
  );
  await assert.rejects(
    buildClassicSplTransferTransaction({
      ...validInput,
      destinationOwnerAddress: FEE_PAYER
    }),
    /three different wallets/
  );
  await assert.rejects(
    buildClassicSplTransferTransaction({
      ...validInput,
      destinationOwnerAddress: TREASURY_AUTHORITY
    }),
    /three different wallets/
  );
});

test("rejects zero amounts and values outside the SPL u64 range", async () => {
  await assert.rejects(
    buildClassicSplTransferTransaction({ ...validInput, amountBaseUnits: 0n }),
    /positive u64/
  );
  await assert.rejects(
    buildClassicSplTransferTransaction({ ...validInput, amountBaseUnits: 18446744073709551616n }),
    /positive u64/
  );
});

test("rejects invalid decimals and negative block heights", async () => {
  await assert.rejects(
    buildClassicSplTransferTransaction({ ...validInput, decimals: 19 }),
    /decimals/
  );
  await assert.rejects(
    buildClassicSplTransferTransaction({ ...validInput, lastValidBlockHeight: -1n }),
    /block height/
  );
});
