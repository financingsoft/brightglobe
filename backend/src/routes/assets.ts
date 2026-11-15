import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db/client.js";
import type { BetterAuthInstance } from "../auth.js";
import type { AppEnvironment } from "../config/env.js";
import { createSolanaGateway } from "../blockchain/solana/gateway.js";
import { CLASSIC_SPL_TOKEN_PROGRAM_ID, parseClassicSplMint, parseClassicSplTokenAccount, type ParsedSplMint } from "../blockchain/solana/token/classic-token.js";
import { buildClassicSplTransferTransaction, deriveClassicSplAssociatedTokenAccounts, deriveClassicSplAssociatedTokenAddress } from "../blockchain/solana/transfer-builder.js";
import { createRequireCanonicalAuth, type CanonicalAuthVariables } from "../middleware/require-canonical-auth.js";
import {
  assetAccounts,
  assetLedgerPostings,
  assetLedgerTransactions,
  assetRegistry,
  assetTransactionIntents,
  chainObservedEvents,
  walletOwnerships
} from "../db/schema.js";
import { isValidSolanaAddress } from "../blockchain/solana/address.js";
import { getAssetByCode, getOrCreateUserAssetAccount, AssetNotFoundError } from "../assets/asset-service.js";
import { createAssetTransactionIntent, AssetTransactionConflictError, getActiveTransferReservationBaseUnits, transitionAssetTransaction } from "../assets/transactions/transaction-service.js";
import { hasBlockhashExpired } from "../assets/transactions/blockhash.js";
import { decodeBase58 } from "../auth/wallet/base58.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createAssetRoutes(db: Database, auth: BetterAuthInstance, env: AppEnvironment) {
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
      const reservedBaseUnits = await getActiveTransferReservationBaseUnits(db, {
        canonicalUserId: current.canonicalUserId,
        assetId: asset.id
      });
      const spendableBaseUnits = account.balanceBaseUnits - reservedBaseUnits;
      return context.json({
        assetCode: asset.assetCode,
        network: asset.network,
        status: asset.status,
        decimals: asset.decimals,
        balanceBaseUnits: account.balanceBaseUnits.toString(),
        reservedBaseUnits: reservedBaseUnits.toString(),
        spendableBaseUnits: (spendableBaseUnits > 0n ? spendableBaseUnits : 0n).toString()
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json({ error: { code: "ASSET_NOT_FOUND", message: error.message } }, 404);
      }
      throw error;
    }
  });

  routes.get("/:assetCode/activity", async (context) => {
    const current = context.get("canonicalAuth");
    const rawLimit = Number(context.req.query("limit") ?? "30");
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 30;
    try {
      const asset = await getAssetByCode(db, context.req.param("assetCode"));
      const ledgerRows = await db.select({
        id: assetLedgerTransactions.id,
        transactionType: assetLedgerTransactions.transactionType,
        referenceType: assetLedgerTransactions.referenceType,
        referenceId: assetLedgerTransactions.referenceId,
        deltaBaseUnits: assetLedgerPostings.deltaBaseUnits,
        createdAt: assetLedgerTransactions.createdAt
      }).from(assetLedgerPostings)
        .innerJoin(assetAccounts, eq(assetAccounts.id, assetLedgerPostings.accountId))
        .innerJoin(assetLedgerTransactions, eq(assetLedgerTransactions.id, assetLedgerPostings.transactionId))
        .where(and(
          eq(assetAccounts.assetId, asset.id),
          eq(assetAccounts.canonicalUserId, current.canonicalUserId),
          eq(assetAccounts.accountType, "user")
        ))
        .orderBy(desc(assetLedgerTransactions.createdAt), desc(assetLedgerTransactions.id))
        .limit(limit);

      const intentIds = [...new Set(ledgerRows
        .filter((row) => row.referenceType === "asset_transaction_intent")
        .map((row) => row.referenceId))];
      const eventIds = [...new Set(ledgerRows
        .filter((row) => row.referenceType === "chain_observed_event")
        .map((row) => row.referenceId))];
      const [referencedIntents, referencedEvents, recentIntents] = await Promise.all([
        intentIds.length
          ? db.select().from(assetTransactionIntents).where(inArray(assetTransactionIntents.id, intentIds))
          : Promise.resolve([]),
        eventIds.length
          ? db.select().from(chainObservedEvents).where(inArray(chainObservedEvents.id, eventIds))
          : Promise.resolve([]),
        db.select().from(assetTransactionIntents)
          .where(and(
            eq(assetTransactionIntents.assetId, asset.id),
            eq(assetTransactionIntents.canonicalUserId, current.canonicalUserId)
          ))
          .orderBy(desc(assetTransactionIntents.createdAt), desc(assetTransactionIntents.id))
          .limit(limit)
      ]);
      const intentById = new Map(referencedIntents.map((intent) => [intent.id, intent] as const));
      const eventById = new Map(referencedEvents.map((event) => [event.id, event] as const));
      const settledIntentIds = new Set(intentIds);

      const ledgerItems = ledgerRows.map((row) => {
        const intent = row.referenceType === "asset_transaction_intent"
          ? intentById.get(row.referenceId)
          : undefined;
        const event = row.referenceType === "chain_observed_event"
          ? eventById.get(row.referenceId)
          : undefined;
        return {
          id: row.id,
          type: event?.eventType ?? row.transactionType,
          deltaBaseUnits: row.deltaBaseUnits.toString(),
          status: "settled",
          chainSignature: intent?.chainSignature ?? event?.signature ?? null,
          ledgerSettled: true,
          createdAt: row.createdAt.toISOString()
        };
      });

      const pendingItems = recentIntents
        .filter((intent) => !settledIntentIds.has(intent.id))
        .map((intent) => ({
          id: intent.id,
          type: intent.operation,
          deltaBaseUnits: "-" + intent.amountBaseUnits.toString(),
          status: intent.status === "finalized" && !intent.ledgerPostedAt
            ? "settling"
            : intent.status,
          chainSignature: intent.chainSignature,
          ledgerSettled: intent.ledgerPostedAt !== null,
          createdAt: intent.createdAt.toISOString()
        }));

      const items = [...ledgerItems, ...pendingItems]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit);
      return context.json({
        assetCode: asset.assetCode,
        network: asset.network,
        items
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json({ error: { code: "ASSET_NOT_FOUND", message: error.message } }, 404);
      }
      throw error;
    }
  });

  routes.get("/:assetCode/wallet/:ownerAddress", async (context) => {
    const current = context.get("canonicalAuth");
    const ownerAddress = context.req.param("ownerAddress");
    if (!isValidSolanaAddress(ownerAddress)) {
      return context.json({
        error: { code: "INVALID_WALLET_ADDRESS", message: "The Solana wallet address is invalid." }
      }, 400);
    }

    const [wallet] = await db.select({ address: walletOwnerships.address })
      .from(walletOwnerships)
      .where(and(
        eq(walletOwnerships.canonicalUserId, current.canonicalUserId),
        eq(walletOwnerships.network, "devnet"),
        eq(walletOwnerships.address, ownerAddress)
      ))
      .limit(1);
    if (!wallet) {
      return context.json({
        error: { code: "WALLET_NOT_LINKED", message: "The wallet is not linked to this BrightGlobe account." }
      }, 403);
    }

    try {
      const asset = await getAssetByCode(db, context.req.param("assetCode"));
      if (asset.status !== "active" || !asset.mintAddress || asset.decimals === null) {
        return context.json({
          error: { code: "ASSET_NOT_ACTIVE", message: "The asset is not configured for on-chain balance queries." }
        }, 409);
      }
      if (env.SOLANA_NETWORK !== "devnet") {
        return context.json({
          error: { code: "SOLANA_NETWORK_DISABLED", message: "Only Solana Devnet wallet balance queries are enabled." }
        }, 503);
      }

      const gateway = createSolanaGateway(env.SOLANA_RPC_URL);
      const cluster = await gateway.getDevnetStatus();
      if (!cluster.healthy) {
        return context.json({
          error: { code: "SOLANA_RPC_UNAVAILABLE", message: "The Devnet RPC endpoint is not healthy." }
        }, 503);
      }

      const tokenAccountAddress = await deriveClassicSplAssociatedTokenAddress({
        ownerAddress,
        mintAddress: asset.mintAddress
      });
      const accountInfo = await gateway.getAccountInfo(tokenAccountAddress, "finalized");
      if (!accountInfo.account) {
        return context.json({
          assetCode: asset.assetCode,
          network: "devnet",
          ownerAddress,
          mintAddress: asset.mintAddress,
          decimals: asset.decimals,
          tokenAccountAddress,
          tokenAccountExists: false,
          onChainBalanceBaseUnits: "0",
          commitment: "finalized"
        });
      }

      let tokenAccount;
      try {
        tokenAccount = parseClassicSplTokenAccount({
          owner: accountInfo.account.owner,
          dataBase64: accountInfo.account.data[0]
        });
      } catch {
        return context.json({
          error: { code: "TOKEN_ACCOUNT_INVALID", message: "The associated token account is invalid." }
        }, 409);
      }
      if (
        tokenAccount.owner !== ownerAddress ||
        tokenAccount.mint !== asset.mintAddress ||
        tokenAccount.state === "uninitialized"
      ) {
        return context.json({
          error: { code: "TOKEN_ACCOUNT_MISMATCH", message: "The associated token account does not match the linked wallet and registered asset." }
        }, 409);
      }

      return context.json({
        assetCode: asset.assetCode,
        network: "devnet",
        ownerAddress,
        mintAddress: asset.mintAddress,
        decimals: asset.decimals,
        tokenAccountAddress,
        tokenAccountExists: true,
        accountState: tokenAccount.state,
        onChainBalanceBaseUnits: tokenAccount.amountBaseUnits.toString(),
        commitment: "finalized",
        slot: accountInfo.contextSlot.toString()
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json({
          error: { code: "ASSET_NOT_FOUND", message: error.message }
        }, 404);
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
      !/^[1-9][0-9]{0,19}$/.test(body.amountBaseUnits) ||
      BigInt(body.amountBaseUnits) > 18446744073709551615n ||
      typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 1 || body.idempotencyKey.length > 128
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

      if (asset.status !== "active" || !asset.mintAddress || asset.decimals === null) {
        return context.json({ error: { code: "ASSET_NOT_ACTIVE", message: "The asset is not active for transfers." } }, 409);
      }
      const mintAddress = asset.mintAddress;
      const configuredDecimals = asset.decimals;
      if (env.SOLANA_NETWORK !== "devnet") {
        return context.json({ error: { code: "SOLANA_NETWORK_DISABLED", message: "Devnet transaction creation is currently disabled." } }, 503);
      }
      const gateway = createSolanaGateway(env.SOLANA_RPC_URL);
      const cluster = await gateway.getDevnetStatus();
      if (!cluster.healthy) {
        return context.json({ error: { code: "SOLANA_RPC_UNAVAILABLE", message: "The Devnet RPC endpoint is not healthy." } }, 503);
      }
      if (asset.tokenProgram !== CLASSIC_SPL_TOKEN_PROGRAM_ID) {
        return context.json({ error: { code: "UNSUPPORTED_TOKEN_PROGRAM", message: "Only the classic SPL Token program is supported." } }, 409);
      }
      const mintAccount = await gateway.getAccountInfo(mintAddress, "finalized");
      if (!mintAccount.account) {
        return context.json({ error: { code: "ASSET_MINT_NOT_FOUND", message: "The configured BG mint account was not found on Devnet." } }, 409);
      }
      let parsedMint: ParsedSplMint;
      try {
        parsedMint = parseClassicSplMint({
          owner: mintAccount.account.owner,
          dataBase64: mintAccount.account.data[0]
        });
      } catch {
        return context.json({ error: { code: "ASSET_MINT_INVALID", message: "The configured mint is not a valid classic SPL Token mint." } }, 409);
      }
      if (parsedMint.decimals !== configuredDecimals) {
        return context.json({ error: { code: "ASSET_DECIMALS_MISMATCH", message: "The configured asset decimals do not match the on-chain mint." } }, 409);
      }
      const amountBaseUnits = BigInt(body.amountBaseUnits);
      const { sourceTokenAccount, destinationTokenAccount } = await deriveClassicSplAssociatedTokenAccounts({
        sourceOwnerAddress: body.fromAddress,
        destinationOwnerAddress: body.toAddress,
        mintAddress
      });
      const sourceAccountInfo = await gateway.getAccountInfo(sourceTokenAccount, "finalized");
      if (!sourceAccountInfo.account) {
        return context.json({
          error: { code: "SOURCE_TOKEN_ACCOUNT_MISSING", message: "The source wallet does not have an associated BG token account." }
        }, 409);
      }

      let parsedSourceAccount;
      try {
        parsedSourceAccount = parseClassicSplTokenAccount({
          owner: sourceAccountInfo.account.owner,
          dataBase64: sourceAccountInfo.account.data[0]
        });
      } catch {
        return context.json({
          error: { code: "SOURCE_TOKEN_ACCOUNT_INVALID", message: "The source associated token account is invalid." }
        }, 409);
      }
      if (
        parsedSourceAccount.owner !== body.fromAddress ||
        parsedSourceAccount.mint !== mintAddress ||
        parsedSourceAccount.state !== "initialized"
      ) {
        return context.json({
          error: { code: "SOURCE_TOKEN_ACCOUNT_MISMATCH", message: "The source associated token account does not match the linked wallet and BG mint." }
        }, 409);
      }
      if (parsedSourceAccount.amount < amountBaseUnits) {
        return context.json({
          error: { code: "INSUFFICIENT_ONCHAIN_BALANCE", message: "The source wallet does not have enough on-chain BG." }
        }, 409);
      }

      // The app-side ledger must also cover the transfer. A finalized chain
      // transfer cannot be accepted if it would leave the internal projection
      // negative; inbound wallet events are reconciled by the chain indexer.
      const ledgerAccount = await getOrCreateUserAssetAccount(db, {
        canonicalUserId: current.canonicalUserId,
        assetId: asset.id
      });
      if (ledgerAccount.balanceBaseUnits < amountBaseUnits) {
        return context.json({
          error: { code: "INSUFFICIENT_LEDGER_BALANCE", message: "The BrightGlobe asset ledger has not yet recorded enough available BG for this transfer." }
        }, 409);
      }

      const blockhash = await gateway.getLatestBlockhash("confirmed");
      const result = await createAssetTransactionIntent(db, {
        canonicalUserId: current.canonicalUserId,
        assetId: asset.id,
        operation: "transfer",
        amountBaseUnits,
        fromAddress: body.fromAddress,
        toAddress: body.toAddress,
        idempotencyKey: body.idempotencyKey,
        recentBlockhash: blockhash.blockhash,
        lastValidBlockHeight: BigInt(blockhash.lastValidBlockHeight)
      });
      const [intent] = await db.select().from(assetTransactionIntents)
        .where(eq(assetTransactionIntents.id, result.intentId))
        .limit(1);
      if (!intent) throw new Error("The asset transaction intent could not be reloaded.");
      if (intent.status !== "created") {
        return context.json({
          error: { code: "TRANSACTION_NOT_SUBMITTABLE", message: "This idempotent transaction intent is no longer in its initial state." },
          id: intent.id,
          status: intent.status,
          chainSignature: intent.chainSignature
        }, 409);
      }
      if (intent.expiresAt !== null && intent.expiresAt <= new Date()) {
        await transitionAssetTransaction(db, {
          intentId: intent.id,
          toStatus: "expired",
          reason: "intent_expired"
        });
        return context.json({
          error: { code: "TRANSACTION_INTENT_EXPIRED", message: "The transfer intent expired before the wallet received it. Start a new transfer." }
        }, 409);
      }
      if (intent.recentBlockhash === null || intent.lastValidBlockHeight === null) {
        return context.json({
          error: { code: "TRANSACTION_BLOCKHASH_MISSING", message: "The transaction intent has no valid recent blockhash window." }
        }, 409);
      }
      const currentBlockHeight = await gateway.getBlockHeight("confirmed");
      if (hasBlockhashExpired(BigInt(currentBlockHeight), intent.lastValidBlockHeight)) {
        await transitionAssetTransaction(db, {
          intentId: intent.id,
          toStatus: "expired",
          reason: "blockhash_expired"
        });
        return context.json({
          error: { code: "TRANSACTION_BLOCKHASH_EXPIRED", message: "The transaction blockhash expired before the wallet received the transaction. Create a new intent." }
        }, 409);
      }

      const transaction = await buildClassicSplTransferTransaction({
        feePayerAddress: body.fromAddress,
        destinationOwnerAddress: body.toAddress,
        mintAddress,
        amountBaseUnits,
        decimals: configuredDecimals,
        recentBlockhash: intent.recentBlockhash,
        lastValidBlockHeight: intent.lastValidBlockHeight
      });
      return context.json({
        ...result,
        status: "created",
        mintAddress,
        decimals: configuredDecimals,
        sourceTokenAccount: transaction.sourceTokenAccount,
        destinationTokenAccount: transaction.destinationTokenAccount,
        transactionBase64: transaction.transactionBase64
      }, result.replayed ? 200 : 201);
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
    if (intent.recentBlockhash === null || intent.lastValidBlockHeight === null) {
      return context.json({ error: { code: "TRANSACTION_BLOCKHASH_MISSING", message: "The transaction intent has no valid recent blockhash window." } }, 409);
    }
    if (env.SOLANA_NETWORK !== "devnet") {
      return context.json({ error: { code: "SOLANA_NETWORK_DISABLED", message: "Devnet transaction submission verification is disabled." } }, 503);
    }
    const gateway = createSolanaGateway(env.SOLANA_RPC_URL);
    const cluster = await gateway.getDevnetStatus();
    if (!cluster.healthy) {
      return context.json({ error: { code: "SOLANA_RPC_UNAVAILABLE", message: "The Devnet RPC endpoint is not healthy." } }, 503);
    }
    const [signatureStatus, currentBlockHeight] = await Promise.all([
      gateway.getSignatureStatuses([body.signature]),
      gateway.getBlockHeight("confirmed")
    ]);
    const observedStatus = signatureStatus.value[0];
    if (!observedStatus && hasBlockhashExpired(BigInt(currentBlockHeight), intent.lastValidBlockHeight)) {
      if (intent.status === "created" || intent.status === "signed") {
        await transitionAssetTransaction(db, {
          intentId: intent.id,
          toStatus: "expired",
          reason: "blockhash_expired"
        });
      }
      return context.json({ error: { code: "TRANSACTION_BLOCKHASH_EXPIRED", message: "The transaction blockhash expired before the signature reached Devnet. Create a new intent." } }, 409);
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
      recentBlockhash: intent.recentBlockhash,
      lastValidBlockHeight: intent.lastValidBlockHeight?.toString() ?? null,
      chainSlot: intent.chainSlot?.toString() ?? null,
      chainCommitment: intent.chainCommitment,
      ledgerSettled: intent.ledgerPostedAt !== null,
      ledgerPostedAt: intent.ledgerPostedAt?.toISOString() ?? null,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString()
    });
  });

  return routes;
}
