import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client.js";
import type { BetterAuthInstance } from "../auth.js";
import { createRequireCanonicalAuth, type CanonicalAuthVariables } from "../middleware/require-canonical-auth.js";
import { assetRegistry, assetTransactionIntents, walletOwnerships } from "../db/schema.js";
import { isValidSolanaAddress } from "../blockchain/solana/address.js";
import { getAssetByCode, getOrCreateUserAssetAccount, AssetNotFoundError } from "../assets/asset-service.js";
import { createAssetTransactionIntent, AssetTransactionConflictError, transitionAssetTransaction } from "../assets/transactions/transaction-service.js";
import { decodeBase58 } from "../auth/wallet/base58.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createAssetRoutes(db: Database, auth: BetterAuthInstance) {
  const routes = new Hono<{ Variables: CanonicalAuthVariables }>();
  routes.use("*", createRequireCanonicalAuth(db, auth));

  routes.get("/", async (context) => {
    const assets = await db.select().from(assetRegistry)
      .where(eq(assetRegistry.network, "devnet"));
    return context.json({
      assets: assets.map((asset) => ({
        assetCode: asset.assetCode,
        network: asset.network,
        tokenProgram: asset.tokenProgram,
        mintAddress: asset.mintAddress,
        decimals: asset.decimals,
        status: asset.status,
        metadataSource: asset.metadataSource
      }))
    });
  });

  routes.get("/:assetCode", async (context) => {
    try {
      const asset = await getAssetByCode(db, context.req.param("assetCode"));
      return context.json({
        assetCode: asset.assetCode,
        network: asset.network,
        tokenProgram: asset.tokenProgram,
        mintAddress: asset.mintAddress,
        decimals: asset.decimals,
        status: asset.status,
        metadataSource: asset.metadataSource
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json({ error: { code: "ASSET_NOT_FOUND", message: error.message } }, 404);
      }
      throw error;
    }
  });

  routes.get("/:assetCode/account", async (context) => {
    const current = context.get("canonicalAuth");
    try {
      const asset = await getAssetByCode(db, context.req.param("assetCode"));
      const account = await getOrCreateUserAssetAccount(db, {
        canonicalUserId: current.canonicalUserId,
        assetId: asset.id
      });
      return context.json({
        assetCode: asset.assetCode,
        network: asset.network,
        status: asset.status,
        decimals: asset.decimals,
        balanceBaseUnits: account.balanceBaseUnits.toString()
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json({ error: { code: "ASSET_NOT_FOUND", message: error.message } }, 404);
      }
      throw error;
    }
  });

  routes.post("/:assetCode/transactions", async (context) => {
    const current = context.get("canonicalAuth");
    const body: unknown = await context.req.json().catch(() => null);
    if (
      !isRecord(body) ||
      typeof body.operation !== "string" ||
      typeof body.amountBaseUnits !== "string" ||
      !/^[1-9][0-9]*$/.test(body.amountBaseUnits) ||
      typeof body.idempotencyKey !== "string"
    ) {
      return context.json({
        error: { code: "INVALID_REQUEST", message: "Operation, positive integer base units, and idempotency key are required." }
      }, 400);
    }

    try {
      const asset = await getAssetByCode(db, context.req.param("assetCode"));
      if (body.operation !== "transfer") {
        return context.json({ error: { code: "UNSUPPORTED_ASSET_OPERATION", message: "The asset operation is not supported." } }, 400);
      }
      if (typeof body.fromAddress !== "string" || typeof body.toAddress !== "string" ||
          !isValidSolanaAddress(body.fromAddress) || !isValidSolanaAddress(body.toAddress) ||
          body.fromAddress === body.toAddress) {
        return context.json({ error: { code: "INVALID_TRANSFER_ADDRESSES", message: "A valid, linked source wallet and a different destination wallet are required." } }, 400);
      }
      const [sourceWallet] = await db.select().from(walletOwnerships)
        .where(and(
          eq(walletOwnerships.canonicalUserId, current.canonicalUserId),
          eq(walletOwnerships.network, "devnet"),
          eq(walletOwnerships.address, body.fromAddress)
        ))
        .limit(1);
      if (!sourceWallet) {
        return context.json({ error: { code: "SOURCE_WALLET_NOT_LINKED", message: "The source wallet is not linked to this BrightGlobe account." } }, 403);
      }

      const result = await createAssetTransactionIntent(db, {
        canonicalUserId: current.canonicalUserId,
        assetId: asset.id,
        operation: "transfer",
        amountBaseUnits: BigInt(body.amountBaseUnits),
        fromAddress: typeof body.fromAddress === "string" ? body.fromAddress : null,
        toAddress: typeof body.toAddress === "string" ? body.toAddress : null,
        idempotencyKey: body.idempotencyKey
      });
      return context.json({ ...result, status: "created" }, result.replayed ? 200 : 201);
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json({ error: { code: "ASSET_NOT_FOUND", message: error.message } }, 404);
      }
      if (error instanceof AssetTransactionConflictError) {
        return context.json({ error: { code: "ASSET_TRANSACTION_UNAVAILABLE", message: error.message } }, 409);
      }
      throw error;
    }
  });

  routes.post("/transactions/:intentId/submitted", async (context) => {
    const current = context.get("canonicalAuth");
    const body: unknown = await context.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.signature !== "string" || !decodeBase58(body.signature, 64)) {
      return context.json({ error: { code: "INVALID_CHAIN_SIGNATURE", message: "A valid base58 Solana transaction signature is required." } }, 400);
    }

    const [intent] = await db.select().from(assetTransactionIntents)
      .where(and(
        eq(assetTransactionIntents.id, context.req.param("intentId")),
        eq(assetTransactionIntents.canonicalUserId, current.canonicalUserId)
      ))
      .limit(1);
    if (!intent) {
      return context.json({ error: { code: "TRANSACTION_NOT_FOUND", message: "The transaction intent was not found." } }, 404);
    }
    if (intent.chainSignature && intent.chainSignature !== body.signature) {
      return context.json({ error: { code: "CHAIN_SIGNATURE_MISMATCH", message: "A different chain signature is already attached to this intent." } }, 409);
    }
    if (intent.status === "submitted" && intent.chainSignature === body.signature) {
      return context.json({ id: intent.id, status: "submitted", chainSignature: intent.chainSignature }, 200);
    }
    try {
      if (intent.status === "created") {
        await transitionAssetTransaction(db, {
          intentId: intent.id,
          toStatus: "signed",
          reason: "wallet_signed_transaction"
        });
      } else if (intent.status !== "signed") {
        return context.json({ error: { code: "TRANSACTION_NOT_SUBMITTABLE", message: "The transaction intent is not in a submittable state." } }, 409);
      }

      await transitionAssetTransaction(db, {
        intentId: intent.id,
        toStatus: "submitted",
        reason: "client_reported_chain_submission",
        chainSignature: body.signature
      });
      return context.json({
        id: intent.id,
        status: "submitted",
        chainSignature: body.signature,
        note: "Submission is not finality; the backend will verify the transaction against finalized Devnet state."
      }, 202);
    } catch (error) {
      if (error instanceof AssetTransactionConflictError) {
        return context.json({ error: { code: "TRANSACTION_STATE_CONFLICT", message: error.message } }, 409);
      }
      throw error;
    }
  });

  routes.get("/transactions/:intentId", async (context) => {
    const current = context.get("canonicalAuth");
    const [intent] = await db.select().from(assetTransactionIntents)
      .where(and(
        eq(assetTransactionIntents.id, context.req.param("intentId")),
        eq(assetTransactionIntents.canonicalUserId, current.canonicalUserId)
      ))
      .limit(1);
    if (!intent) {
      return context.json({ error: { code: "TRANSACTION_NOT_FOUND", message: "The transaction intent was not found." } }, 404);
    }
    return context.json({
      id: intent.id,
      assetId: intent.assetId,
      operation: intent.operation,
      amountBaseUnits: intent.amountBaseUnits.toString(),
      status: intent.status,
      chainSignature: intent.chainSignature,
      chainSlot: intent.chainSlot?.toString() ?? null,
      chainCommitment: intent.chainCommitment,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString()
    });
  });

  return routes;
}
