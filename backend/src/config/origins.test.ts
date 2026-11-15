import assert from "node:assert/strict";
import test from "node:test";
import { buildTrustedOrigins, isAllowedOrigin, parseOrigins, resolveAllowedRequestOrigin } from "./origins.js";

test("parseOrigins trims values, removes blanks and de-duplicates", () => {
  assert.deepEqual(parseOrigins(" https://a.example, ,https://b.example,https://a.example "), [
    "https://a.example",
    "https://b.example"
  ]);
});

test("Expo development origins are never allowed in production", () => {
  assert.equal(isAllowedOrigin("exp://192.168.1.10:8081", "https://app.example", "development"), true);
  assert.equal(isAllowedOrigin("exp://192.168.1.10:8081", "https://app.example", "production"), false);
});

test("production origins are exact and include the native scheme", () => {
  assert.deepEqual(buildTrustedOrigins("https://app.example", "production"), [
    "https://app.example",
    "brightglobe://",
    "brightglobe://auth"
  ]);
  assert.equal(isAllowedOrigin("brightglobe://auth", "https://app.example", "production"), true);
  assert.equal(isAllowedOrigin("https://untrusted.example", "https://app.example", "production"), false);
});

test("resolves explicitly marked native requests without weakening browser origin checks", () => {
  assert.equal(resolveAllowedRequestOrigin(undefined, "native", "https://app.example", "production"), "brightglobe://auth");
  assert.equal(resolveAllowedRequestOrigin(undefined, undefined, "https://app.example", "production"), null);
  assert.equal(resolveAllowedRequestOrigin("https://evil.example", "native", "https://app.example", "production"), null);
  assert.equal(resolveAllowedRequestOrigin("https://app.example", undefined, "https://app.example", "production"), "https://app.example");
});
