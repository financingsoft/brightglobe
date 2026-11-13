import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth.js";
import { env } from "./config/env.js";
import { isAllowedOrigin } from "./config/origins.js";
import { db } from "./db/client.js";
import { meRoutes } from "./routes/me.js";
import { bdRoutes } from "./routes/bd.js";

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
  apiVersion: "v1"
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
app.route("/api/v1/me", meRoutes);
app.route("/api/v1/me/bd", bdRoutes);

app.notFound((context) => context.json({
  error: { code: "NOT_FOUND", message: "The requested endpoint does not exist." }
}, 404));

app.onError((error, context) => {
  console.error("[BrightGlobe API]", error);
  return context.json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." }
  }, 500);
});

export { app };
