import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "../blockchain/solana/token/classic-token.js";

const SUPPORTED_EVENT_TYPES = new Set(["transfer", "mint_to", "burn"]);

export function classifyChainEvent(input: { programId: string; eventType: string }): "observed" | "quarantined" {
  if (input.programId !== CLASSIC_SPL_TOKEN_PROGRAM_ID) return "quarantined";
  if (!SUPPORTED_EVENT_TYPES.has(input.eventType)) return "quarantined";
  return "observed";
}
