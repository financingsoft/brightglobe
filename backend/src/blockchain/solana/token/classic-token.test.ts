import assert from "node:assert/strict";
import test from "node:test";
import {
  baseUnitsToDecimalString,
  CLASSIC_SPL_TOKEN_PROGRAM_ID,
  decimalStringToBaseUnits,
  parseClassicSplMint,
  parseClassicSplTokenAccount,
  SplTokenAccountError
} from "./classic-token.js";

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

test("parses classic SPL Token mint supply and decimals without floating point", () => {
  const data = new Uint8Array(82);
  new DataView(data.buffer).setBigUint64(36, 123456789012345678n, true);
  data[44] = 9;
  data[45] = 1;
  const mint = parseClassicSplMint({ owner: CLASSIC_SPL_TOKEN_PROGRAM_ID, dataBase64: base64(data) });
  assert.equal(mint.supplyBaseUnits, 123456789012345678n);
  assert.equal(mint.decimals, 9);
  assert.equal(mint.initialized, true);
  assert.equal(mint.mintAuthority, null);
});

test("rejects a mint owned by another token program", () => {
  assert.throws(() => parseClassicSplMint({ owner: "wrong", dataBase64: base64(new Uint8Array(82)) }), SplTokenAccountError);
});

test("rejects uninitialized mints and invalid account lengths", () => {
  const data = new Uint8Array(82);
  assert.throws(() => parseClassicSplMint({ owner: CLASSIC_SPL_TOKEN_PROGRAM_ID, dataBase64: base64(data) }), /not initialized/);
  assert.throws(() => parseClassicSplMint({ owner: CLASSIC_SPL_TOKEN_PROGRAM_ID, dataBase64: base64(new Uint8Array(80)) }), /82 bytes/);
});

test("parses token account mint, owner, amount and state", () => {
  const data = new Uint8Array(165);
  data[108] = 1;
  new DataView(data.buffer).setBigUint64(64, 9007199254740993123n, true);
  const account = parseClassicSplTokenAccount({ owner: CLASSIC_SPL_TOKEN_PROGRAM_ID, dataBase64: base64(data) });
  assert.equal(account.amountBaseUnits, 9007199254740993123n);
  assert.equal(account.state, "initialized");
});

test("converts decimal strings using integer base units only", () => {
  assert.equal(decimalStringToBaseUnits("9007199254.740993123", 9), 9007199254740993123n);
  assert.equal(baseUnitsToDecimalString(9007199254740993123n, 9), "9007199254.740993123");
  assert.throws(() => decimalStringToBaseUnits("1.001", 2), /fractional digits/);
  assert.throws(() => decimalStringToBaseUnits("1e3", 9), /decimal string/);
});
