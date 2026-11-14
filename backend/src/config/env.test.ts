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
});

test("rejects production without a configured SMS gateway", () => {
  assert.throws(
    () => parseEnvironment({ ...requiredBindings, NODE_ENV: "production" }),
    /Production requires SMS_GATEWAY_URL and SMS_GATEWAY_TOKEN/
  );
});

test("requires an HTTPS SMS gateway in production", () => {
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
