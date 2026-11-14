import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { BetterAuthInstance } from "./auth.js";
import type { AppEnvironment } from "./config/env.js";
import { isAllowedOrigin } from "./config/origins.js";
import type { Database } from "./db/client.js";
import { createMeRoutes } from "./routes/me.js";
import { createBdRoutes } from "./routes/bd.js";

interface AppDependencies {
  db: Database;
  auth: BetterAuthInstance;
  env: AppEnvironment;
}

export function createApp({ db, auth, env }: AppDependencies) {
  const app = new Hono();

  app.use("/api/*", cors({
    origin: (origin) => isAllowedOrigin(origin, env.APP_ORIGINS, env.NODE_ENV) ? origin : "",
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Set-Cookie"],
    credentials: true,
    maxAge: 600
  }));

  app.get("/", (context) => context.json({
    service: "brightglobe-backend",
    status: "ok",
    apiVersion: "v1",
    runtime: "cloudflare-workers"
  }));

  app.get("/health/live", (context) => context.json({ status: "ok" }));

  app.get("/health/ready", async (context) => {
    try {
      await db.execute(sql`select 1`);
      return context.json({ status: "ready", database: "reachable" });
    } catch {
      return context.json({ status: "not_ready", database: "unavailable" }, 503);
    }
  });

  app.all("/api/auth/*", (context) => auth.handler(context.req.raw));
  app.route("/api/v1/me", createMeRoutes(db, auth));
  app.route("/api/v1/me/bd", createBdRoutes(db, auth));

  app.notFound((context) => context.json({
    error: { code: "NOT_FOUND", message: "The requested endpoint does not exist." }
  }, 404));

  app.onError((error, context) => {
    console.error("[BrightGlobe API]", error);
    return context.json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." }
    }, 500);
  });

  return app;
}
