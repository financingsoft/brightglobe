import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletSignInMessage } from "./message.js";

const base = {
  domain: "test.globeapps.com",
  uri: "https://test.globeapps.com/login",
  address: "11111111111111111111111111111111",
  network: "devnet" as const,
  nonce: "a".repeat(64),
  issuedAt: new Date("2026-11-15T10:00:00.000Z"),
  expiresAt: new Date("2026-11-15T10:05:00.000Z")
};

test("builds a deterministic network-bound wallet sign-in message", () => {
  const message = buildWalletSignInMessage(base);
  assert.match(message, /wants you to sign in with your Solana account/);
  assert.match(message, /Chain ID: solana:devnet/);
  assert.match(message, /Nonce: a{64}/);
  assert.match(message, /Expiration Time:/);
});

test("rejects an invalid wallet address", () => {
  assert.throws(() => buildWalletSignInMessage({ ...base, address: "not-a-wallet" }), /address/);
});

test("rejects a URI whose host does not match the signing domain", () => {
  assert.throws(() => buildWalletSignInMessage({ ...base, uri: "https://evil.example/login" }), /host/);
});

test("rejects an expired message window", () => {
  assert.throws(() => buildWalletSignInMessage({
    ...base,
    expiresAt: new Date("2026-11-15T09:59:00.000Z")
  }), /expiration/);
});

test("uses an explicit wallet-link statement for account linking", () => {
  assert.match(buildWalletSignInMessage({ ...base, purpose: "link" }), /Link this wallet to your BrightGlobe account/);
});
