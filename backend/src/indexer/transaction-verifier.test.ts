import assert from "node:assert/strict";
import test from "node:test";
import { matchesFinalizedTransferIntent, type TransferEventLike } from "./transaction-verifier.js";

const expected = {
  fromAddress: "source-owner",
  toAddress: "destination-owner",
  amountBaseUnits: 500n,
  mintAddress: "bg-mint",
  slot: 900n
};
const sourceAccounts = new Set(["source-token-account"]);
const destinationAccounts = new Set(["destination-token-account"]);

function event(overrides: Partial<TransferEventLike> = {}): TransferEventLike {
  return {
    eventType: "transfer",
    slot: 900n,
    payload: {
      source: "source-token-account",
      destination: "destination-token-account",
      authority: "source-owner",
      amountBaseUnits: "500",
      mint: "bg-mint"
    },
    ...overrides
  };
}

test("accepts an exact finalized transfer from the linked source wallet to the intended destination", () => {
  assert.equal(matchesFinalizedTransferIntent([event()], expected, sourceAccounts, destinationAccounts), true);
});

test("rejects wrong amount, mint, source owner, destination account, slot or event type", () => {
  const cases = [
    event({ payload: { ...event().payload, amountBaseUnits: "501" } }),
    event({ payload: { ...event().payload, mint: "other-mint" } }),
    event({ payload: { ...event().payload, authority: "attacker" } }),
    event({ payload: { ...event().payload, source: "other-source" } }),
    event({ payload: { ...event().payload, destination: "other-destination" } }),
    event({ slot: 901n }),
    event({ eventType: "mint_to" })
  ];
  for (const candidate of cases) {
    assert.equal(matchesFinalizedTransferIntent([candidate], expected, sourceAccounts, destinationAccounts), false);
  }
});
