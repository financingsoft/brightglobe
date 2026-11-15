export interface SolanaRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: SolanaRpcError;
}

export class SolanaRpcRequestError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly data?: unknown
  ) {
    super(message);
    this.name = "SolanaRpcRequestError";
  }
}

export interface SolanaRpcClient {
  request<T>(method: string, params?: readonly unknown[]): Promise<T>;
  getHealth(): Promise<string>;
  getBlockHeight(commitment?: "processed" | "confirmed" | "finalized"): Promise<number>;
  getLatestBlockhash(commitment?: "processed" | "confirmed" | "finalized"): Promise<{
    context: { slot: number };
    value: { blockhash: string; lastValidBlockHeight: number };
  }>;
  getSignatureStatuses(
    signatures: readonly string[],
    searchTransactionHistory?: boolean
  ): Promise<{
    context: { slot: number };
    value: Array<{
      slot: number;
      confirmations: number | null;
      err: unknown | null;
      confirmationStatus?: "processed" | "confirmed" | "finalized";
    } | null>;
  }>;
}

export function createSolanaRpcClient(
  endpoint: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; maxRetries?: number } = {}
): SolanaRpcClient {
  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== "https:") {
    throw new Error("Solana RPC endpoint must use HTTPS.");
  }

  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Solana RPC timeout must be between 1 and 60000 milliseconds.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? 1;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) {
    throw new Error("Solana RPC retries must be between 0 and 3.");
  }
  let nextId = 1;

  async function request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    const id = nextId++;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetchImpl(parsedEndpoint.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal
        });

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
            continue;
          }
          throw new SolanaRpcRequestError(`Solana RPC returned HTTP ${response.status}.`);
        }
        break;
      } catch (error) {
        if (error instanceof SolanaRpcRequestError) throw error;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
        if (controller.signal.aborted) {
          throw new SolanaRpcRequestError("Solana RPC request timed out.");
        }
        throw new SolanaRpcRequestError("Solana RPC request failed.");
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!response || !response.ok) {
      throw new SolanaRpcRequestError("Solana RPC request failed after bounded retries.");
    }

    let payload: JsonRpcResponse<T>;
    try {
      payload = await response.json() as JsonRpcResponse<T>;
    } catch {
      throw new SolanaRpcRequestError("Solana RPC returned invalid JSON.");
    }

    if (payload.id !== id || payload.jsonrpc !== "2.0") {
      throw new SolanaRpcRequestError("Solana RPC returned a mismatched JSON-RPC response.");
    }
    if (payload.error) {
      throw new SolanaRpcRequestError(
        payload.error.message,
        payload.error.code,
        payload.error.data
      );
    }
    if (!("result" in payload)) {
      throw new SolanaRpcRequestError("Solana RPC response did not contain a result.");
    }

    return payload.result as T;
  }

  return {
    request,
    getHealth: () => request<string>("getHealth"),
    getBlockHeight: (commitment = "confirmed") =>
      request<number>("getBlockHeight", [{ commitment }]),
    getLatestBlockhash: (commitment = "confirmed") =>
      request<{ context: { slot: number }; value: { blockhash: string; lastValidBlockHeight: number } }>("getLatestBlockhash", [{ commitment }]),
    getSignatureStatuses: (signatures, searchTransactionHistory = false) =>
      request<{ context: { slot: number }; value: Array<{ slot: number; confirmations: number | null; err: unknown | null; confirmationStatus?: "processed" | "confirmed" | "finalized" } | null> }>("getSignatureStatuses", [
        [...signatures],
        { searchTransactionHistory }
      ])
  };
}
