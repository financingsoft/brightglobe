import { Platform } from "react-native";
import { authClient } from "@/auth/client";

type ApiErrorBody = {
  message?: string;
  code?: string;
  error?: {
    message?: string;
    code?: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // The Expo plugin stores native session cookies in SecureStore. Attach them
  // to first-party API requests; browsers use credentialed cookie handling.
  if (Platform.OS !== "web") {
    const cookie = await authClient.getCookie();
    if (cookie) headers.set("Cookie", cookie);
  }

  const response = await fetch(API_BASE_URL + normalizedPath, {
    ...init,
    headers,
    credentials: Platform.OS === "web" ? "include" : "omit"
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Keep the HTTP status as the fallback error detail.
    }

    throw new ApiError(
      body.error?.message ?? body.message ?? "The request could not be completed.",
      response.status,
      body.error?.code ?? body.code
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
