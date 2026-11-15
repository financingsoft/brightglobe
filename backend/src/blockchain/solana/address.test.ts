import assert from "node:assert/strict";
import test from "node:test";
import { decodeSolanaAddress, isValidSolanaAddress } from "./address.js";

test("accepts the all-zero Solana system program address", () => {
  const address = "11111111111111111111111111111111";
  assert.equal(isValidSolanaAddress(address), true);
  assert.deepEqual([...decodeSolanaAddress(address)!], Array(32).fill(0));
});

test("decodes a known 32-byte Solana program address", () => {
  const address = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const decoded = decodeSolanaAddress(address);
  assert.equal(decoded?.length, 32);
  assert.equal(isValidSolanaAddress(address), true);
});

test("rejects invalid base58 characters", () => {
  assert.equal(isValidSolanaAddress("0".repeat(32)), false);
  assert.equal(isValidSolanaAddress("O".repeat(32)), false);
  assert.equal(isValidSolanaAddress("not a wallet address"), false);
});

test("rejects base58 values that do not decode to exactly 32 bytes", () => {
  assert.equal(isValidSolanaAddress("1111111111111111111111111111111"), false);
  assert.equal(isValidSolanaAddress("111111111111111111111111111111111"), false);
  assert.equal(decodeSolanaAddress(""), null);
});
