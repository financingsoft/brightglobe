import assert from "node:assert/strict";
import test from "node:test";
import { decodeFinalizedClassicTokenEvents } from "./transaction-decoder.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "./token/classic-token.js";

test("decodes parsed transferChecked instruction with exact base units", () => {
  const events = decodeFinalizedClassicTokenEvents("signature", {
    slot: 100,
    meta: { err: null, innerInstructions: [] },
    transaction: {
      message: {
        instructions: [{
          program: "spl-token",
          programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
          parsed: {
            type: "transferChecked",
            info: {
              source: "source-account",
              destination: "destination-account",
              authority: "owner",
              mint: "mint",
              tokenAmount: { amount: "9007199254740993123", decimals: 9 }
            }
          }
        }]
      }
    }
  });
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "transfer");
  assert.equal(events[0]!.payload.amountBaseUnits, "9007199254740993123");
  assert.equal(events[0]!.payload.decimals, 9);
  assert.equal(events[0]!.slot, 100n);
});

test("does not decode failed transactions or unrelated programs", () => {
  const failed = decodeFinalizedClassicTokenEvents("signature", {
    slot: 100,
    meta: { err: { InstructionError: [0, "Custom"] }, innerInstructions: [] },
    transaction: { message: { instructions: [] } }
  });
  assert.deepEqual(failed, []);

  const unrelated = decodeFinalizedClassicTokenEvents("signature", {
    slot: 100,
    meta: { err: null, innerInstructions: [] },
    transaction: { message: { instructions: [{ programId: "other", parsed: { type: "transfer", info: { amount: "1" } } }] } }
  });
  assert.deepEqual(unrelated, []);
});

test("quarantinable unknown SPL instructions preserve their account context", () => {
  const events = decodeFinalizedClassicTokenEvents("signature", {
    slot: 1,
    meta: { err: null, innerInstructions: [] },
    transaction: {
      message: {
        instructions: [{
          programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
          parsed: { type: "closeAccount", info: { account: "token-account", destination: "wallet" } }
        }]
      }
    }
  });
  assert.equal(events[0]!.eventType, "unsupported_instruction");
  assert.equal(events[0]!.payload.account, "token-account");
  assert.equal(events[0]!.payload.destination, "wallet");
});
