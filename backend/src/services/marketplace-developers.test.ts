import assert from "node:assert/strict";
import test from "node:test";
import {
  hashDeveloperInvitationToken,
  normalizeDeveloperSlug,
  normalizeInvitationEmail
} from "./marketplace-developers.js";

test("normalizes developer slugs and rejects ambiguous values", () => {
  assert.equal(normalizeDeveloperSlug("  Globe-Tools  "), "globe-tools");
  assert.throws(() => normalizeDeveloperSlug("two words"));
  assert.throws(() => normalizeDeveloperSlug("ab"));
  assert.throws(() => normalizeDeveloperSlug("-invalid"));
});

test("normalizes invitation email addresses", () => {
  assert.equal(normalizeInvitationEmail("  Publisher@Example.COM "), "publisher@example.com");
  assert.throws(() => normalizeInvitationEmail("not-an-email"));
});

test("hashes only 256-bit hexadecimal invitation tokens", async () => {
  const rawToken = "a".repeat(64);
  const first = await hashDeveloperInvitationToken(rawToken);
  const second = await hashDeveloperInvitationToken(rawToken.toUpperCase());
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, rawToken);
  await assert.rejects(() => hashDeveloperInvitationToken("short-token"));
});
