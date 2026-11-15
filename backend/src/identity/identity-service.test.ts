import assert from "node:assert/strict";
import test from "node:test";
import { createUuidV7 } from "./ids.js";

test("canonical identity IDs are server-generated UUIDv7 values", () => {
  assert.match(createUuidV7(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

// Database-backed provisioning race and idempotency tests are added with the
// repository's isolated Neon integration harness in the next implementation pass.
