const apiBase = process.env.NEXT_PUBLIC_DEVELOPER_API_URL;

if (!apiBase) {
  throw new Error("NEXT_PUBLIC_DEVELOPER_API_URL is required.");
}

type ApiEnvelope<T> = { data: T };
type ApiError = { error?: { message?: string; code?: string } };

export async function developerApi<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Invalid developer API path.");
  }

  const response = await fetch(apiBase + path, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  const body = await response.json().catch(() => null) as ApiEnvelope<T> & ApiError | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "The developer request could not be completed.");
  }
  if (!body || !("data" in body)) {
    throw new Error("The developer API returned an invalid response.");
  }
  return body.data;
}
