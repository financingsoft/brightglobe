import { Hono, type Context } from "hono";
import type { AppEnvironment } from "../config/env.js";
import type { Database } from "../db/client.js";
import { resolveAllowedRequestOrigin } from "../config/origins.js";
import {
  clearWalletSessionCookie,
  buildWalletSessionCookie,
  readWalletSessionCredential
} from "../auth/wallet/cookie.js";
import {
  createWalletChallenge,
  revokeWalletSession,
  verifyWalletChallenge,
  WalletAuthError
} from "../auth/wallet/service.js";
import type { BetterAuthInstance } from "../auth.js";
import { createRequireCanonicalAuth, type CanonicalAuthVariables } from "../middleware/require-canonical-auth.js";

interface WalletRouteDependencies {
  db: Database;
  env: AppEnvironment;
  auth: BetterAuthInstance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createWalletAuthRoutes({ db, env, auth }: WalletRouteDependencies) {
  const routes = new Hono<{ Variables: CanonicalAuthVariables }>();
  const requireCanonicalAuth = createRequireCanonicalAuth(db, auth);

  function resolveOrigin(context: Context<{ Variables: CanonicalAuthVariables }>): string | null {
    return resolveAllowedRequestOrigin(
      context.req.header("Origin"),
      context.req.header("X-BrightGlobe-Client"),
      env.APP_ORIGINS,
      env.NODE_ENV
    );
  }

  function nativeMessageLocation(origin: string): { domain?: string; uri?: string } {
    if (!origin.startsWith("brightglobe://")) return {};
    const apiUrl = new URL(env.BETTER_AUTH_URL);
    const apiPrefix = apiUrl.pathname.replace(/\/api\/auth\/?$/, "");
    return {
      domain: apiUrl.host,
      uri: new URL(`${apiPrefix}/api/v1/auth/wallet`, apiUrl.origin).toString()
    };
  }

  function isNative(origin: string): boolean {
    return origin.startsWith("brightglobe://");
  }

  routes.post("/challenge", async (context) => {
    const origin = resolveOrigin(context);
    if (!origin) {
      return context.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed." } }, 403);
    }
    if (env.SOLANA_NETWORK !== "devnet") {
      return context.json({ error: { code: "WALLET_AUTH_DISABLED", message: "Wallet sign-in is not enabled." } }, 503);
    }

    const body: unknown = await context.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.address !== "string") {
      return context.json({ error: { code: "INVALID_REQUEST", message: "A wallet address is required." } }, 400);
    }

    try {
      const challenge = await createWalletChallenge(db, {
        address: body.address,
        origin,
        network: "devnet",
        ipAddress: context.req.header("CF-Connecting-IP"),
        ...nativeMessageLocation(origin)
      });
      return context.json({ ...challenge, network: "devnet", purpose: "sign_in" });
    } catch (error) {
      if (error instanceof WalletAuthError) {
        return context.json({ error: { code: error.code, message: error.message } }, error.status as 400 | 401 | 403 | 404 | 409 | 429);
      }
      throw error;
    }
  });

  routes.post("/verify", async (context) => {
    const origin = resolveOrigin(context);
    if (!origin) {
      return context.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed." } }, 403);
    }
    if (env.SOLANA_NETWORK !== "devnet") {
      return context.json({ error: { code: "WALLET_AUTH_DISABLED", message: "Wallet sign-in is not enabled." } }, 503);
    }

    const body: unknown = await context.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.challengeId !== "string" || typeof body.address !== "string" || typeof body.signature !== "string") {
      return context.json({ error: { code: "INVALID_REQUEST", message: "The challenge ID, wallet address, and signature are required." } }, 400);
    }

    try {
      const result = await verifyWalletChallenge(db, {
        challengeId: body.challengeId,
        address: body.address,
        signature: body.signature,
        origin,
        ipAddress: context.req.header("CF-Connecting-IP"),
        userAgent: context.req.header("User-Agent")
      });
      if (isNative(origin)) {
        return context.json({
          canonicalUserId: result.canonicalUserId,
          sessionExpiresAt: result.sessionExpiresAt,
          authentication: "wallet",
          sessionToken: result.sessionToken
        });
      }
      context.header("Set-Cookie", buildWalletSessionCookie(result.sessionToken, 30 * 24 * 60 * 60));
      return context.json({
        canonicalUserId: result.canonicalUserId,
        sessionExpiresAt: result.sessionExpiresAt,
        authentication: "wallet"
      });
    } catch (error) {
      if (error instanceof WalletAuthError) {
        return context.json({ error: { code: error.code, message: error.message } }, error.status as 400 | 401 | 403 | 404 | 409 | 429);
      }
      throw error;
    }
  });

  routes.post("/link/challenge", requireCanonicalAuth, async (context) => {
    const origin = resolveOrigin(context);
    if (!origin) {
      return context.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed." } }, 403);
    }
    if (env.SOLANA_NETWORK !== "devnet") {
      return context.json({ error: { code: "WALLET_AUTH_DISABLED", message: "Wallet sign-in is not enabled." } }, 503);
    }
    const body: unknown = await context.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.address !== "string") {
      return context.json({ error: { code: "INVALID_REQUEST", message: "A wallet address is required." } }, 400);
    }
    try {
      const current = context.get("canonicalAuth");
      const challenge = await createWalletChallenge(db, {
        address: body.address,
        origin,
        network: "devnet",
        purpose: "link",
        canonicalUserId: current.canonicalUserId,
        ipAddress: context.req.header("CF-Connecting-IP"),
        ...nativeMessageLocation(origin)
      });
      return context.json({ ...challenge, network: "devnet", purpose: "link" });
    } catch (error) {
      if (error instanceof WalletAuthError) {
        return context.json({ error: { code: error.code, message: error.message } }, error.status as 400 | 401 | 403 | 404 | 409 | 429);
      }
      throw error;
    }
  });

  routes.post("/link/verify", requireCanonicalAuth, async (context) => {
    const origin = resolveOrigin(context);
    if (!origin) {
      return context.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed." } }, 403);
    }
    const body: unknown = await context.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.challengeId !== "string" || typeof body.address !== "string" || typeof body.signature !== "string") {
      return context.json({ error: { code: "INVALID_REQUEST", message: "The challenge ID, wallet address, and signature are required." } }, 400);
    }
    try {
      const current = context.get("canonicalAuth");
      const result = await verifyWalletChallenge(db, {
        challengeId: body.challengeId,
        address: body.address,
        signature: body.signature,
        origin,
        expectedCanonicalUserId: current.canonicalUserId,
        ipAddress: context.req.header("CF-Connecting-IP"),
        userAgent: context.req.header("User-Agent")
      });
      if (isNative(origin)) {
        return context.json({
          canonicalUserId: result.canonicalUserId,
          sessionExpiresAt: result.sessionExpiresAt,
          authentication: "wallet",
          linked: true,
          sessionToken: result.sessionToken
        });
      }
      context.header("Set-Cookie", buildWalletSessionCookie(result.sessionToken, 30 * 24 * 60 * 60));
      return context.json({
        canonicalUserId: result.canonicalUserId,
        sessionExpiresAt: result.sessionExpiresAt,
        authentication: "wallet",
        linked: true
      });
    } catch (error) {
      if (error instanceof WalletAuthError) {
        return context.json({ error: { code: error.code, message: error.message } }, error.status as 400 | 401 | 403 | 404 | 409 | 429);
      }
      throw error;
    }
  });

  routes.post("/logout", async (context) => {
    const origin = resolveOrigin(context);
    if (!origin) {
      return context.json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed." } }, 403);
    }
    const token = readWalletSessionCredential(
      context.req.header("Cookie") ?? null,
      context.req.header("Authorization") ?? null
    );
    if (token) await revokeWalletSession(db, token);
    context.header("Set-Cookie", clearWalletSessionCookie());
    return context.body(null, 204);
  });

  return routes;
}
