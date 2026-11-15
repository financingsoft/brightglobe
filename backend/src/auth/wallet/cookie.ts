export const WALLET_SESSION_COOKIE = "__Host-bg_wallet_session";

export function readWalletSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === WALLET_SESSION_COOKIE) return rawValue.join("=") || null;
  }
  return null;
}

export function buildWalletSessionCookie(token: string, maxAgeSeconds: number): string {
  return `${WALLET_SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearWalletSessionCookie(): string {
  return `${WALLET_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function readWalletSessionCredential(
  cookieHeader: string | null,
  authorizationHeader: string | null
): string | null {
  const bearer = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) return bearer[1].trim() || null;
  return readWalletSessionCookie(cookieHeader);
}
