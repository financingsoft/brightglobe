import { z } from "zod";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID } from "./token/classic-token.js";
import type { FinalizedChainEvent } from "../../indexer/indexer-service.js";

const parsedInstructionSchema = z.object({
  programId: z.string().optional(),
  program: z.string().optional(),
  parsed: z.object({
    type: z.string(),
    info: z.record(z.string(), z.unknown())
  }).optional()
});

function stringField(info: Record<string, unknown>, key: string): string | null {
  const value = info[key];
  return typeof value === "string" ? value : null;
}

function amountField(info: Record<string, unknown>): string | null {
  const amount = info.amount;
  if (typeof amount === "string") return amount;
  const tokenAmount = info.tokenAmount;
  if (typeof tokenAmount === "object" && tokenAmount !== null && "amount" in tokenAmount) {
    const value = (tokenAmount as { amount?: unknown }).amount;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function decodeInstruction(
  instruction: unknown,
  signature: string,
  slot: bigint,
  instructionIndex: number,
  eventIndex: number
): FinalizedChainEvent | null {
  const parsed = parsedInstructionSchema.safeParse(instruction);
  if (!parsed.success || parsed.data.programId !== CLASSIC_SPL_TOKEN_PROGRAM_ID || !parsed.data.parsed) {
    return null;
  }

  const info = parsed.data.parsed.info;
  const type = parsed.data.parsed.type;
  const eventType = type === "transfer" || type === "transferChecked"
    ? "transfer"
    : type === "mintTo" || type === "mintToChecked"
      ? "mint_to"
      : type === "burn" || type === "burnChecked"
        ? "burn"
        : "unsupported_instruction";
  const amountBaseUnits = amountField(info);
  const payload = {
    source: stringField(info, "source"),
    destination: stringField(info, "destination"),
    authority: stringField(info, "authority"),
    account: stringField(info, "account"),
    mint: stringField(info, "mint"),
    authorityType: stringField(info, "authorityType"),
    newAuthority: stringField(info, "newAuthority"),
    delegate: stringField(info, "delegate"),
    owner: stringField(info, "owner"),
    amountBaseUnits,
    decimals: typeof info.decimals === "number" && Number.isInteger(info.decimals)
      ? info.decimals
      : typeof info.tokenAmount === "object" && info.tokenAmount !== null &&
          "decimals" in info.tokenAmount &&
          typeof (info.tokenAmount as { decimals?: unknown }).decimals === "number" &&
          Number.isInteger((info.tokenAmount as { decimals: number }).decimals)
        ? (info.tokenAmount as { decimals: number }).decimals
        : null,
    originalType: type
  };

  if (eventType === "unsupported_instruction") {
    return {
      signature,
      slot,
      instructionIndex,
      eventIndex,
      programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      eventType,
      payload
    };
  }
  if (!amountBaseUnits || !/^(0|[1-9][0-9]*)$/.test(amountBaseUnits)) {
    return {
      signature,
      slot,
      instructionIndex,
      eventIndex,
      programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
      eventType: "malformed_instruction",
      payload
    };
  }

  return {
    signature,
    slot,
    instructionIndex,
    eventIndex,
    programId: CLASSIC_SPL_TOKEN_PROGRAM_ID,
    eventType,
    payload: { ...payload, amountBaseUnits }
  };
}

/**
 * Extracts explicitly parsed classic SPL Token instructions from a finalized
 * jsonParsed transaction. It does not infer events from balance deltas.
 */
export function decodeFinalizedClassicTokenEvents(
  signature: string,
  transaction: unknown
): FinalizedChainEvent[] {
  const transactionSchema = z.object({
    slot: z.number().int().nonnegative(),
    meta: z.object({
      err: z.unknown().nullable(),
      innerInstructions: z.array(z.object({
        index: z.number().int().nonnegative(),
        instructions: z.array(z.unknown())
      })).nullable().optional()
    }).nullable(),
    transaction: z.object({
      message: z.object({ instructions: z.array(z.unknown()) })
    })
  });

  const parsed = transactionSchema.safeParse(transaction);
  if (!parsed.success || parsed.data.meta?.err !== null) return [];

  const events: FinalizedChainEvent[] = [];
  let eventIndex = 0;
  const outer = parsed.data.transaction.message.instructions;
  for (let instructionIndex = 0; instructionIndex < outer.length; instructionIndex += 1) {
    const event = decodeInstruction(outer[instructionIndex], signature, BigInt(parsed.data.slot), instructionIndex, eventIndex++);
    if (event) events.push(event);
  }

  for (const group of parsed.data.meta.innerInstructions ?? []) {
    for (const instruction of group.instructions) {
      const event = decodeInstruction(instruction, signature, BigInt(parsed.data.slot), group.index, eventIndex++);
      if (event) events.push(event);
    }
  }
  return events;
}
