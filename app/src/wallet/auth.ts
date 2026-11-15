import * as SecureStore from "expo-secure-store";
import bs58 from "bs58";
import { apiBaseUrl, authClient } from "@/auth/client";

const SESSION_KEY = "brightglobe.wallet.session.v1";

export type WalletSession = {
  token: string;
  canonicalUserId: string;
  expiresAt: string;
};

type WalletChallenge = {
  challengeId: string;
  message: string;
  expiresAt: string;
};

type WalletVerifyResponse = {
  canonicalUserId: string;
  sessionExpiresAt: string;
  authentication: "wallet";
  sessionToken: string;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
  message?: string;
};

export class WalletAuthError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "WalletAuthError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
  cookie?: string
): Promise<T> {
  if (!apiBaseUrl) throw new Error("BrightGlobe API is not configured.");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("X-BrightGlobe-Client", "native");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "omit"
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = await response.json() as ApiErrorBody;
    } catch {
      // Preserve the HTTP status if the response body is not JSON.
    }
    throw new WalletAuthError(
      body.error?.message ?? body.message ?? "Wallet authentication failed.",
      response.status,
      body.error?.code
    );
  }

  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export async function getWalletSession(): Promise<WalletSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as WalletSession;
    if (
      typeof session.token !== "string" ||
      typeof session.canonicalUserId !== "string" ||
      typeof session.expiresAt !== "string" ||
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function clearWalletSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function walletSessionRequest<T>(
  path: string,
  init: RequestInit = {},
  token: string
): Promise<T> {
  return request<T>(path, init, token);
}

export async function signInWithSolanaWallet(
  address: string,
  chainId: string,
  provider: {
    request: (
      args: { method: "solana_signMessage"; params: { message: string; pubkey: string } },
      chain: string
    ) => Promise<unknown>;
  }
): Promise<WalletSession> {
  if (chainId !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1") {
    throw new Error("BrightGlobe wallet sign-in is Devnet-only. Switch your wallet to Solana Devnet.");
  }

  const challenge = await request<WalletChallenge>("/api/v1/auth/wallet/challenge", {
    method: "POST",
    body: JSON.stringify({ address })
  });

  const messageBytes = new TextEncoder().encode(challenge.message);
  const result = await provider.request(
    {
      method: "solana_signMessage",
      params: { message: bs58.encode(messageBytes), pubkey: address }
    },
    `solana:${chainId}`
  );

  if (
    typeof result !== "object" ||
    result === null ||
    !("signature" in result) ||
    typeof (result as { signature?: unknown }).signature !== "string"
  ) {
    throw new Error("The connected wallet did not return a valid message signature.");
  }

  const verified = await request<WalletVerifyResponse>("/api/v1/auth/wallet/verify", {
    method: "POST",
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      address,
      signature: (result as { signature: string }).signature
    })
  });

  if (!verified.sessionToken || !verified.canonicalUserId || !verified.sessionExpiresAt) {
    throw new Error("The server returned an incomplete wallet session.");
  }

  const session: WalletSession = {
    token: verified.sessionToken,
    canonicalUserId: verified.canonicalUserId,
    expiresAt: verified.sessionExpiresAt
  };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function revokeWalletSession(token: string): Promise<void> {
  await request<void>("/api/v1/auth/wallet/logout", { method: "POST" }, token);
}

export async function linkSolanaWalletToEmail(
  address: string,
  chainId: string,
  provider: {
    request: (
      args: { method: "solana_signMessage"; params: { message: string; pubkey: string } },
      chain: string
    ) => Promise<unknown>;
  }
): Promise<WalletSession> {
  if (chainId !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1") {
    throw new Error("BrightGlobe wallet linking is Devnet-only. Switch your wallet to Solana Devnet.");
  }
  const cookie = await authClient.getCookie();
  if (!cookie) throw new Error("Sign in with your verified email account before linking a wallet.");

  const challenge = await request<WalletChallenge>(
    "/api/v1/auth/wallet/link/challenge",
    { method: "POST", body: JSON.stringify({ address }) },
    undefined,
    cookie
  );
  const messageBytes = new TextEncoder().encode(challenge.message);
  const result = await provider.request(
    {
      method: "solana_signMessage",
      params: { message: bs58.encode(messageBytes), pubkey: address }
    },
    `solana:${chainId}`
  );
  if (
    typeof result !== "object" ||
    result === null ||
    !("signature" in result) ||
    typeof (result as { signature?: unknown }).signature !== "string"
  ) {
    throw new Error("The connected wallet did not return a valid message signature.");
  }

  const verified = await request<WalletVerifyResponse>(
    "/api/v1/auth/wallet/link/verify",
    {
      method: "POST",
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        address,
        signature: (result as { signature: string }).signature
      })
    },
    undefined,
    cookie
  );
  if (!verified.sessionToken || !verified.canonicalUserId || !verified.sessionExpiresAt) {
    throw new Error("The server returned an incomplete linked wallet session.");
  }
  const session: WalletSession = {
    token: verified.sessionToken,
    canonicalUserId: verified.canonicalUserId,
    expiresAt: verified.sessionExpiresAt
  };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}
