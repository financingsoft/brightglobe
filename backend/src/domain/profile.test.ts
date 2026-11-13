import assert from "node:assert/strict";
import test from "node:test";
import { profileUpdateSchema } from "./profile.js";

test("accepts a valid profile patch", () => {
  const result = profileUpdateSchema.safeParse({
    displayName: "BrightGlobe Member",
    locale: "en-US",
    countryCode: "US",
    avatarUrl: "https://cdn.example.com/avatar.png"
  });
  assert.equal(result.success, true);
});

test("rejects identity and server-owned fields", () => {
  const result = profileUpdateSchema.safeParse({
    userId: "attacker-controlled",
    role: "admin",
    pointsBalance: 999999
  });
  assert.equal(result.success, false);
});

test("rejects non-HTTPS avatar URLs and empty patches", () => {
  assert.equal(profileUpdateSchema.safeParse({ avatarUrl: "http://cdn.example.com/avatar.png" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({}).success, false);
});
