import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import { schema } from "./schema.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "test" ? 2 : 10,
  application_name: "brightglobe-backend"
});

export const db = drizzle(pool, { schema });
