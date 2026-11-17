import { Hono } from "hono";
import { cors } from "hono/cors";
import type { DeveloperRouteDependencies } from "./developer-routes.js";
import { createDeveloperRoutes } from "./developer-routes.js";

export interface DeveloperRateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface DeveloperPrivateAppOptions {
  dependencies: DeveloperRouteDependencies;
  allowedOrigins: string[];
  rateLimiter: DeveloperRateLimitBinding;
}

function privateError(code: string, message: string, status: 400 | 403 | 404 | 415 | 429 | 503, requestId: string) {
  return Response.json({ error: { code, message, requestId } }, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "Vary": "Origin, Cookie, Authorization",
      "X-Request-Id": requestId
    }
  });
}

/**
 * Separate private Worker application. It has no public projection routes and
 * is never mounted into the public read Worker.
 */
export function createDeveloperPrivateApp(options: DeveloperPrivateAppOptions) {
  const app = new Hono();
  const origins = new Set(options.allowedOrigins);

  app.use("*", async (context, next) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Pragma", "no-cache");
    context.header("Vary", "Origin, Cookie, Authorization");
    await next();
  });

  app.use("*", cors({
    origin: (origin) => origin && origins.has(origin) ? origin : "",
    allowHeaders: ["Content-Type", "X-Request-Id"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 600
  }));

  app.use("*", async (context, next) => {
    const method = context.req.method.toUpperCase();
    if (method !== "POST" && method !== "DELETE") {
      await next();
      return;
    }

    const requestId = context.req.header("X-Request-Id") && /^[A-Za-z0-9._-]{8,100}$/.test(context.req.header("X-Request-Id")!)
      ? context.req.header("X-Request-Id")!
      : crypto.randomUUID();
    const origin = context.req.header("Origin");
    if (!origin || !origins.has(origin)) {
      return privateError("ORIGIN_NOT_ALLOWED", "The request origin is not allowed.", 403, requestId);
    }

    if (method === "POST") {
      const contentType = context.req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase();
      if (contentType !== "application/json") {
        return privateError("JSON_REQUIRED", "Developer mutations require an application/json request body.", 415, requestId);
      }
    }

    const ipAddress = context.req.header("CF-Connecting-IP") ?? "unknown";
    try {
      // Do not include arbitrary path parameters in the IP bucket key.
      const limited = await options.rateLimiter.limit({
        key: "ip:" + ipAddress + ":" + method
      });
      if (!limited.success) {
        return privateError("RATE_LIMITED", "Too many requests. Try again later.", 429, requestId);
      }
    } catch {
      return privateError("RATE_LIMIT_UNAVAILABLE", "The developer platform is temporarily unavailable.", 503, requestId);
    }

    await next();
  });

  app.get("/health/live", (context) => context.json({ status: "ok", service: "globe-play-private" }));
  app.route("/api/v1/play", createDeveloperRoutes(options.dependencies));

  app.notFound((context) => privateError(
    "NOT_FOUND",
    "The requested endpoint does not exist.",
    404,
    crypto.randomUUID()
  ));
  app.onError((error, context) => {
    const requestId = crypto.randomUUID();
    console.error("[globe-play-private] Unhandled request error", {
      requestId,
      errorType: error instanceof Error ? error.name : "unknown"
    });
    return privateError("INTERNAL_SERVER_ERROR", "The request could not be completed.", 503, requestId);
  });

  return app;
}
