import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvironment } from "./env.js";

const requiredBindings = {
  DATABASE_URL: "postgresql://brightglobe:secret@ep-example.neon.tech/brightglobe",
  BETTER_AUTH_URL: "https://api.example.com",
  BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-thirty-two-characters"
};

test("parses Worker bindings with safe development defaults", () => {
  const env = parseEnvironment(requiredBindings);
  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.DATABASE_URL, requiredBindings.DATABASE_URL);
  assert.equal(env.SMS_ENABLED, true);
  assert.equal(env.EMAIL_ENABLED, false);
  assert.equal(env.SOLANA_NETWORK, "disabled");
  assert.equal(env.SOLANA_RPC_URL, "https://api.devnet.solana.com");
  assert.equal(env.BG_PAYOUT_RECONCILIATION_ENABLED, false);
  assert.equal(env.BG_PAYOUT_ARCHIVE_HISTORY_ENABLED, false);
  assert.equal(env.BG_PAYOUT_RECONCILIATION_BATCH_SIZE, 10);
});

test("enables only Solana Devnet when explicitly configured", () => {
  const env = parseEnvironment({
    ...requiredBindings,
    SOLANA_NETWORK: "devnet",
    SOLANA_RPC_URL: "https://api.devnet.solana.com"
  });
  assert.equal(env.SOLANA_NETWORK, "devnet");
  assert.equal(env.SOLANA_RPC_URL, "https://api.devnet.solana.com");
});

test("rejects unsupported Solana networks", () => {
  assert.throws(
    () => parseEnvironment({ ...requiredBindings, SOLANA_NETWORK: "mainnet-beta" }),
    /SOLANA_NETWORK/
  );
});

test("rejects insecure Solana RPC endpoints", () => {
  assert.throws(
    () => parseEnvironment({
      ...requiredBindings,
      SOLANA_NETWORK: "devnet",
      SOLANA_RPC_URL: "http://api.devnet.solana.com"
    }),
    /SOLANA_RPC_URL must use HTTPS/
  );
});

test("rejects production without a configured SMS gateway when SMS is enabled", () => {
  assert.throws(
    () => parseEnvironment({ ...requiredBindings, NODE_ENV: "production" }),
    /Production requires SMS_GATEWAY_URL and SMS_GATEWAY_TOKEN/
  );
});

test("allows production-mode staging with SMS and email explicitly disabled", () => {
  const env = parseEnvironment({
    ...requiredBindings,
    NODE_ENV: "production",
    SMS_ENABLED: "false",
    EMAIL_ENABLED: "false"
  });
  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.SMS_ENABLED, false);
  assert.equal(env.EMAIL_ENABLED, false);
});

test("requires Resend credentials before enabling email authentication", () => {
  assert.throws(
    () => parseEnvironment({
      ...requiredBindings,
      NODE_ENV: "production",
      SMS_ENABLED: "false",
      EMAIL_ENABLED: "true"
    }),
    /EMAIL_ENABLED requires RESEND_API_KEY and EMAIL_FROM/
  );
});

test("accepts production email authentication with a configured sender", () => {
  const env = parseEnvironment({
    ...requiredBindings,
    NODE_ENV: "production",
    SMS_ENABLED: "false",
    EMAIL_ENABLED: "true",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "BrightGlobe <auth@example.com>"
  });
  assert.equal(env.EMAIL_ENABLED, true);
  assert.equal(env.EMAIL_FROM, "BrightGlobe <auth@example.com>");
});

test("requires an HTTPS SMS gateway in production when SMS is enabled", () => {
  assert.throws(
    () => parseEnvironment({
      ...requiredBindings,
      NODE_ENV: "production",
      SMS_GATEWAY_URL: "http://sms.example.com/send",
      SMS_GATEWAY_TOKEN: "test-token"
    }),
    /Production SMS_GATEWAY_URL must use HTTPS/
  );
});

test("enables read-only BG payout reconciliation only on Devnet", () => {
  const env = parseEnvironment({
    ...requiredBindings,
    SOLANA_NETWORK: "devnet",
    BG_PAYOUT_RECONCILIATION_ENABLED: "true",
    BG_PAYOUT_RECONCILIATION_BATCH_SIZE: "7"
  });
  assert.equal(env.BG_PAYOUT_RECONCILIATION_ENABLED, true);
  assert.equal(env.BG_PAYOUT_ARCHIVE_HISTORY_ENABLED, false);
  assert.equal(env.BG_PAYOUT_RECONCILIATION_BATCH_SIZE, 7);
});

test("archive history completeness requires explicit reconciliation enablement", () => {
  assert.throws(
    () => parseEnvironment({
      ...requiredBindings,
      SOLANA_NETWORK: "devnet",
      BG_PAYOUT_ARCHIVE_HISTORY_ENABLED: "true"
    }),
    /Archive history coverage requires BG payout reconciliation to be enabled/
  );
});

test("reconciliation cannot be enabled when Solana is disabled", () => {
  assert.throws(
    () => parseEnvironment({
      ...requiredBindings,
      BG_PAYOUT_RECONCILIATION_ENABLED: "true"
    }),
    /BG payout reconciliation can only run when SOLANA_NETWORK=devnet/
  );
});

test("reconciliation batch size is bounded", () => {
  assert.throws(
    () => parseEnvironment({
      ...requiredBindings,
      SOLANA_NETWORK: "devnet",
      BG_PAYOUT_RECONCILIATION_BATCH_SIZE: "51"
    }),
    /BG_PAYOUT_RECONCILIATION_BATCH_SIZE/
  );
});

test("archive history completeness requires an explicit archive-capable RPC endpoint", () => {
  assert.throws(
    () => parseEnvironment({
      ...requiredBindings,
      SOLANA_NETWORK: "devnet",
      SOLANA_RPC_URL: "https://api.devnet.solana.com",
      BG_PAYOUT_RECONCILIATION_ENABLED: "true",
      BG_PAYOUT_ARCHIVE_HISTORY_ENABLED: "true"
    }),
    /Archive history coverage requires an explicitly configured archive-capable RPC endpoint/
  );
});
