import assert from "node:assert/strict";
import test from "node:test";
import { canRevokeSession } from "./session-revocation.js";

test("does not allow the current session to be revoked by the session-management API", () => {
  assert.equal(canRevokeSession("current-session", "current-session"), false);
});

test("allows a different session to be revoked", () => {
  assert.equal(canRevokeSession("other-session", "current-session"), true);
});

test("rejects an empty session identifier", () => {
  assert.equal(canRevokeSession("", "current-session"), false);
});
