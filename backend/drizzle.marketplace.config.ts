import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Marketplace-only schema generation target.
 * Output is intentionally outside backend/drizzle and has no migrate script.
 * Do not point this config at Neon Staging for this draft.
 */
export default defineConfig({
  schema: "./src/db/marketplace-schema.ts",
  out: "./drizzle-drafts/generated",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true
});
