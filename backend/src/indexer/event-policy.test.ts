import assert from "node:assert/strict";
import test from "node:test";
import { classifyChainEvent } from "./event-policy.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";

test("accepts only explicitly supported classic SPL Token events", () => {
  assert.equal(classifyChainEvent({ programId: CLASSIC_SPL_TOKEN_PROGRAM_ID, eventType: "transfer" }), "observed");
  assert.equal(classifyChainEvent({ programId: CLASSIC_SPL_TOKEN_PROGRAM_ID, eventType: "mint_to" }), "observed");
});

test("quarantines unknown programs and unknown instruction types", () => {
  assert.equal(classifyChainEvent({ programId: "unknown-program", eventType: "transfer" }), "quarantined");
  assert.equal(classifyChainEvent({ programId: CLASSIC_SPL_TOKEN_PROGRAM_ID, eventType: "mystery" }), "quarantined");
});
