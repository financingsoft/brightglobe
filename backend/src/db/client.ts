import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { schema } from "./schema.js";

/**
 * Create request-scoped database resources for Cloudflare Workers.
 * The Neon WebSocket driver is required for interactive PostgreSQL transactions.
 * The Worker must close this pool after each request; never move it to module scope.
 */
export function createDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000
  });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
