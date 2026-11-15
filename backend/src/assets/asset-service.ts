import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { assetAccounts, assetRegistry } from "../db/schema.js";
import { createUuidV7 } from "../identity/ids.js";

export class AssetNotFoundError extends Error {
  constructor() {
    super("The requested asset is not registered on this network.");
    this.name = "AssetNotFoundError";
  }
}

export async function getAssetByCode(
  db: Database,
  assetCode: string,
  network: "devnet" = "devnet"
) {
  const [asset] = await db.select().from(assetRegistry)
    .where(and(
      eq(assetRegistry.assetCode, assetCode.toUpperCase()),
      eq(assetRegistry.network, network)
    ))
    .limit(1);
  if (!asset) throw new AssetNotFoundError();
  return asset;
}

export async function getOrCreateUserAssetAccount(
  db: Database,
  input: { canonicalUserId: string; assetId: string }
) {
  const [asset] = await db.select({ id: assetRegistry.id }).from(assetRegistry)
    .where(eq(assetRegistry.id, input.assetId))
    .limit(1);
  if (!asset) throw new AssetNotFoundError();

  const now = new Date();
  await db.insert(assetAccounts).values({
    id: createUuidV7(now.getTime()),
    assetId: input.assetId,
    canonicalUserId: input.canonicalUserId,
    accountType: "user",
    balanceBaseUnits: 0n,
    createdAt: now,
    updatedAt: now
  }).onConflictDoNothing();

  const [account] = await db.select().from(assetAccounts)
    .where(and(
      eq(assetAccounts.assetId, input.assetId),
      eq(assetAccounts.canonicalUserId, input.canonicalUserId)
    ))
    .limit(1);
  if (!account) throw new Error("Unable to initialize the user's asset account.");
  return account;
}
