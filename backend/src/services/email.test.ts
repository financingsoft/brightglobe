import assert from "node:assert/strict";
import test from "node:test";
import { createAuthEmail, sendAuthEmail } from "./email.js";

test("verification email contains an action link and escapes HTML content", () => {
  const message = createAuthEmail("verify", "<Member>", "https://example.com/verify?token=a&next=b");
  assert.equal(message.subject, "Verify your BrightGlobe email");
  assert.match(message.text, /https:\/\/example\.com\/verify\?token=a&next=b/);
  assert.match(message.html, /&lt;Member&gt;/);
  assert.match(message.html, /token=a&amp;next=b/);
});

test("password reset email uses the reset subject", () => {
  const message = createAuthEmail("reset", "Member", "https://example.com/reset");
  assert.equal(message.subject, "Reset your BrightGlobe password");
  assert.match(message.text, /reset your BrightGlobe password/i);
});

test("email sender refuses to send while email authentication is disabled", async () => {
  const env = {
    EMAIL_ENABLED: false,
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined
  } as never;
  await assert.rejects(
    sendAuthEmail(env, {
      to: "member@example.com",
      ...createAuthEmail("verify", "Member", "https://example.com/verify")
    }),
    /transactional email is not configured/i
  );
});
