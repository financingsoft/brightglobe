import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import {
  canonicalUsers,
  identityAuditEvents,
  providerIdentities,
  walletChallenges,
  walletOwnerships,
  walletSessions
} from "../../db/schema.js";
import { createUuidV7 } from "../../identity/ids.js";
import { CanonicalIdentityUnavailableError, IdentityConflictError } from "../../identity/identity-service.js";
import { isValidSolanaAddress } from "../../blockchain/solana/address.js";
import { verifySolanaMessageSignature } from "../../blockchain/solana/signature.js";
import { decodeBase58 } from "./base58.js";
import { buildWalletSignInMessage } from "./message.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

function randomSessionToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export class WalletAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "WalletAuthError";
  }
}

export async function createWalletChallenge(
  db: Database,
  input: { address: string; origin: string; network: "devnet"; purpose?: "sign_in" | "link"; canonicalUserId?: string; domain?: string; uri?: string; ipAddress?: string | null }
): Promise<{ challengeId: string; message: string; expiresAt: string }> {
  if (!isValidSolanaAddress(input.address)) {
    throw new WalletAuthError("INVALID_WALLET_ADDRESS", "The Solana wallet address is invalid.");
  }

  const isNativeOrigin = input.origin === "brightglobe://" || input.origin === "brightglobe://auth";
  const parsedOrigin = isNativeOrigin ? null : new URL(input.origin);
  if (!isNativeOrigin && parsedOrigin?.protocol !== "https:") {
    throw new WalletAuthError("INVALID_ORIGIN", "Wallet sign-in requires a secure origin.", 403);
  }
  if (isNativeOrigin && (!input.domain || !input.uri)) {
    throw new WalletAuthError("INVALID_ORIGIN", "Native wallet sign-in requires the canonical HTTPS API domain.", 403);
  }

  const domain = input.domain ?? parsedOrigin!.host;
  const now = new Date();
  const since = new Date(now.getTime() - 60_000);
  const recent = await db.select({ id: walletChallenges.id })
    .from(walletChallenges)
    .where(and(
      eq(walletChallenges.network, input.network),
      gt(walletChallenges.createdAt, since),
      input.ipAddress
        ? or(eq(walletChallenges.walletAddress, input.address), eq(walletChallenges.requestIp, input.ipAddress))
        : eq(walletChallenges.walletAddress, input.address)
    ))
    .limit(3);
  if (recent.length >= 3) {
    throw new WalletAuthError("WALLET_CHALLENGE_RATE_LIMITED", "Too many sign-in attempts. Try again shortly.", 429);
  }

  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const nonce = randomNonce();
  const uri = input.uri ?? new URL("/wallet/sign-in", parsedOrigin!).toString();
  const message = buildWalletSignInMessage({
    domain,
    uri,
    address: input.address,
    network: input.network,
    purpose: input.purpose,
    nonce,
    issuedAt: now,
    expiresAt
  });
  const challengeId = createUuidV7(now.getTime());

  await db.insert(walletChallenges).values({
    id: challengeId,
    walletAddress: input.address,
    network: input.network,
    purpose: input.purpose ?? "sign_in",
    canonicalUserId: input.canonicalUserId ?? null,
    requestIp: input.ipAddress?.slice(0, 64) ?? null,
    origin: input.origin,
    uri,
    nonceHash: await sha256(nonce),
    message,
    issuedAt: now,
    expiresAt
  });

  return { challengeId, message, expiresAt: expiresAt.toISOString() };
}

export async function verifyWalletChallenge(
  db: Database,
  input: {
    challengeId: string;
    address: string;
    signature: string;
    origin: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    expectedCanonicalUserId?: string;
  }
): Promise<{ canonicalUserId: string; sessionExpiresAt: string; sessionToken: string }> {
  if (!isValidSolanaAddress(input.address)) {
    throw new WalletAuthError("INVALID_WALLET_ADDRESS", "The Solana wallet address is invalid.");
  }
  const [challenge] = await db.select().from(walletChallenges)
    .where(eq(walletChallenges.id, input.challengeId))
    .limit(1);

  if (!challenge || challenge.walletAddress !== input.address) {
    throw new WalletAuthError("WALLET_CHALLENGE_NOT_FOUND", "The wallet sign-in challenge was not found.", 404);
  }
  if (challenge.purpose === "link" && (
    !input.expectedCanonicalUserId ||
    challenge.canonicalUserId !== input.expectedCanonicalUserId
  )) {
    throw new WalletAuthError("WALLET_LINK_SESSION_MISMATCH", "The authenticated account does not match this wallet-link challenge.", 403);
  }
  if (challenge.purpose === "sign_in" && input.expectedCanonicalUserId) {
    throw new WalletAuthError("WALLET_CHALLENGE_PURPOSE_MISMATCH", "This challenge cannot be used for account linking.", 400);
  }
  if (challenge.origin !== input.origin) {
    throw new WalletAuthError("WALLET_ORIGIN_MISMATCH", "The wallet sign-in origin does not match.", 403);
  }
  if (challenge.network !== "devnet") {
    throw new WalletAuthError("UNSUPPORTED_WALLET_NETWORK", "Only Solana Devnet wallet sign-in is enabled.", 403);
  }
  const now = new Date();
  if (challenge.consumedAt) {
    throw new WalletAuthError("WALLET_CHALLENGE_REPLAYED", "The wallet sign-in challenge was already used.", 409);
  }
  if (challenge.expiresAt <= now) {
    throw new WalletAuthError("WALLET_CHALLENGE_EXPIRED", "The wallet sign-in challenge has expired.", 409);
  }

  const [attempt] = await db.update(walletChallenges)
    .set({ verificationAttempts: sql`${walletChallenges.verificationAttempts} + 1` })
    .where(and(
      eq(walletChallenges.id, challenge.id),
      isNull(walletChallenges.consumedAt),
      gt(walletChallenges.expiresAt, now),
      lt(walletChallenges.verificationAttempts, 8)
    ))
    .returning({ id: walletChallenges.id });
  if (!attempt) {
    const [current] = await db.select({ consumedAt: walletChallenges.consumedAt })
      .from(walletChallenges)
      .where(eq(walletChallenges.id, challenge.id))
      .limit(1);
    if (current?.consumedAt) {
      throw new WalletAuthError("WALLET_CHALLENGE_REPLAYED", "The wallet sign-in challenge was already used.", 409);
    }
    throw new WalletAuthError("WALLET_VERIFICATION_RATE_LIMITED", "Too many signature attempts for this challenge.", 429);
  }

  const signature = decodeBase58(input.signature, 64);
  if (!signature) {
    throw new WalletAuthError("INVALID_WALLET_SIGNATURE", "The wallet signature is malformed.");
  }

  const nonceMatch = challenge.message.match(/^Nonce: ([a-f0-9]{64})$/m);
  if (!nonceMatch || await sha256(nonceMatch[1]!) !== challenge.nonceHash) {
    throw new WalletAuthError("WALLET_CHALLENGE_INVALID", "The wallet sign-in challenge is invalid.", 400);
  }

  const valid = await verifySolanaMessageSignature(
    input.address,
    new TextEncoder().encode(challenge.message),
    signature
  );
  if (!valid) {
    throw new WalletAuthError("INVALID_WALLET_SIGNATURE", "The wallet signature could not be verified.", 401);
  }

  const verifiedAt = new Date();
  if (challenge.expiresAt <= verifiedAt) {
    throw new WalletAuthError("WALLET_CHALLENGE_EXPIRED", "The wallet sign-in challenge expired during signature verification.", 409);
  }

  const rawSessionToken = randomSessionToken();
  const tokenHash = await sha256(rawSessionToken);
  const sessionExpiresAt = new Date(verifiedAt.getTime() + SESSION_TTL_MS);

  const canonicalUserId = await db.transaction(async (transaction) => {
    const consumed = await transaction.update(walletChallenges)
      .set({ consumedAt: verifiedAt })
      .where(and(
        eq(walletChallenges.id, challenge.id),
        isNull(walletChallenges.consumedAt),
        gt(walletChallenges.expiresAt, verifiedAt)
      ))
      .returning({ id: walletChallenges.id });
    if (consumed.length !== 1) {
      throw new WalletAuthError("WALLET_CHALLENGE_REPLAYED", "The wallet sign-in challenge was already used.", 409);
    }

    const [ownership] = await transaction.select().from(walletOwnerships)
      .where(and(
        eq(walletOwnerships.network, challenge.network),
        eq(walletOwnerships.address, input.address)
      ))
      .limit(1);

    const userIdForLink = challenge.purpose === "link" ? challenge.canonicalUserId : null;
    let userId: string;
    if (userIdForLink) {
      userId = userIdForLink;
      const [owner] = await transaction.select().from(canonicalUsers)
        .where(eq(canonicalUsers.id, userId))
        .limit(1);
      if (!owner || owner.status !== "active") throw new CanonicalIdentityUnavailableError();
      if (ownership && ownership.canonicalUserId !== userId) throw new IdentityConflictError();

      const providerSubject = `${challenge.network}:${input.address}`;
      const [providerIdentity] = await transaction.select().from(providerIdentities)
        .where(and(
          eq(providerIdentities.provider, "solana_wallet"),
          eq(providerIdentities.providerSubject, providerSubject)
        ))
        .limit(1);
      if (providerIdentity && providerIdentity.canonicalUserId !== userId) throw new IdentityConflictError();

      if (!ownership) {
        await transaction.insert(walletOwnerships).values({
          id: createUuidV7(verifiedAt.getTime()),
          canonicalUserId: userId,
          network: challenge.network,
          address: input.address,
          verifiedAt: verifiedAt,
          createdAt: verifiedAt
        });
      }
      if (!providerIdentity) {
        await transaction.insert(providerIdentities).values({
          id: createUuidV7(verifiedAt.getTime()),
          canonicalUserId: userId,
          provider: "solana_wallet",
          providerSubject,
          verifiedAt: verifiedAt,
          createdAt: verifiedAt
        });
      }
      await transaction.insert(identityAuditEvents).values({
        id: createUuidV7(verifiedAt.getTime()),
        canonicalUserId: userId,
        eventType: "wallet_identity_linked",
        actorType: "wallet",
        actorId: input.address,
        metadata: { network: challenge.network }
      });
    } else if (ownership) {
      userId = ownership.canonicalUserId;
      const [owner] = await transaction.select().from(canonicalUsers)
        .where(eq(canonicalUsers.id, userId))
        .limit(1);
      if (!owner || owner.status !== "active") throw new CanonicalIdentityUnavailableError();
    } else {
      userId = createUuidV7(verifiedAt.getTime());
      await transaction.insert(canonicalUsers).values({
        id: userId,
        status: "active",
        createdAt: verifiedAt,
        updatedAt: verifiedAt
      });
      await transaction.insert(providerIdentities).values({
        id: createUuidV7(verifiedAt.getTime()),
        canonicalUserId: userId,
        provider: "solana_wallet",
        providerSubject: `${challenge.network}:${input.address}`,
        verifiedAt: verifiedAt,
        createdAt: verifiedAt
      });
      await transaction.insert(walletOwnerships).values({
        id: createUuidV7(verifiedAt.getTime()),
        canonicalUserId: userId,
        network: challenge.network,
        address: input.address,
        verifiedAt: verifiedAt,
        createdAt: verifiedAt
      });
      await transaction.insert(identityAuditEvents).values({
        id: createUuidV7(verifiedAt.getTime()),
        canonicalUserId: userId,
        eventType: "wallet_identity_created",
        actorType: "wallet",
        actorId: input.address,
        metadata: { network: challenge.network }
      });
    }

    await transaction.insert(walletSessions).values({
      id: createUuidV7(verifiedAt.getTime()),
      canonicalUserId: userId,
      tokenHash,
      expiresAt: sessionExpiresAt,
      lastSeenAt: verifiedAt,
      ipAddress: input.ipAddress?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      createdAt: verifiedAt
    });

    return userId;
  });

  // The raw token is returned only to the route for its HttpOnly cookie.
  // The database stores only the token hash.
  return { canonicalUserId, sessionExpiresAt: sessionExpiresAt.toISOString(), sessionToken: rawSessionToken };
}

export async function hashWalletSessionToken(rawToken: string): Promise<string> {
  return sha256(rawToken);
}

export async function revokeWalletSession(db: Database, rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = await sha256(rawToken);
  await db.update(walletSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(walletSessions.tokenHash, tokenHash),
      isNull(walletSessions.revokedAt)
    ));
}

export function assertWalletIdentityOwnership(
  currentCanonicalUserId: string,
  targetCanonicalUserId: string
): void {
  if (currentCanonicalUserId !== targetCanonicalUserId) throw new IdentityConflictError();
}
