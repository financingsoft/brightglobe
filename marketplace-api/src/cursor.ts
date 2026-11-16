export interface ReviewCursor {
  version: 1;
  appSlug: string;
  locale: string;
  createdAt: string;
  id: string;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function cursorKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function encodeReviewCursor(cursor: ReviewCursor, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(cursor)));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await cursorKey(secret), encoder.encode(payload)));
  return payload + "." + toBase64Url(signature);
}

export async function decodeReviewCursor(value: string, secret: string): Promise<ReviewCursor> {
  if (value.length > 1024) throw new Error("Invalid cursor.");
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) throw new Error("Invalid cursor.");
  const valid = await crypto.subtle.verify(
    "HMAC",
    await cursorKey(secret),
    fromBase64Url(signature),
    encoder.encode(payload)
  );
  if (!valid) throw new Error("Invalid cursor.");
  const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid cursor.");
  const cursor = parsed as Record<string, unknown>;
  if (
    cursor.version !== 1 ||
    typeof cursor.appSlug !== "string" ||
    typeof cursor.locale !== "string" ||
    typeof cursor.createdAt !== "string" ||
    !Number.isFinite(Date.parse(cursor.createdAt)) ||
    typeof cursor.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursor.id)
  ) throw new Error("Invalid cursor.");
  return cursor as unknown as ReviewCursor;
}
