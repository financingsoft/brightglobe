import assert from "node:assert/strict";
import test from "node:test";
import { isE164PhoneNumber, phoneToSyntheticEmail } from "./phone.js";

test("accepts E.164 phone numbers", () => {
  assert.equal(isE164PhoneNumber("+14155552671"), true);
  assert.equal(isE164PhoneNumber("+8613800138000"), true);
});

test("rejects phone numbers outside E.164 format", () => {
  for (const value of ["14155552671", "+0123456789", "+123", "+1 4155552671", "+1234567890123456"]) {
    assert.equal(isE164PhoneNumber(value), false, value);
  }
});

test("creates an internal synthetic email from a verified phone number", () => {
  assert.equal(phoneToSyntheticEmail("+1 (415) 555-2671"), "14155552671@phone.brightglobe.invalid");
});
