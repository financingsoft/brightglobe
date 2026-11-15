import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletSessionCookie, clearWalletSessionCookie, readWalletSessionCookie, readWalletSessionCredential, WALLET_SESSION_COOKIE } from "./cookie.js";

test("sets host-only secure HttpOnly wallet session cookie", () => {
  const cookie = buildWalletSessionCookie("secret-token", 3600);
  assert.match(cookie, new RegExp(`^${WALLET_SESSION_COOKIE}=secret-token;`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
});

test("reads the wallet cookie without confusing other cookies", () => {
  assert.equal(readWalletSessionCookie("a=b; __Host-bg_wallet_session=token-123; c=d"), "token-123");
  assert.equal(readWalletSessionCookie("a=b"), null);
});

test("clears the wallet session cookie", () => {
  assert.match(clearWalletSessionCookie(), /Max-Age=0/);
});

test("prefers bearer credentials for native clients and falls back to the web cookie", () => {
  assert.equal(readWalletSessionCredential(null, "Bearer native-token"), "native-token");
  assert.equal(readWalletSessionCredential("__Host-bg_wallet_session=web-token", null), "web-token");
});
