import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must contain at least 32 characters."),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be an absolute URL."),
  APP_ORIGINS: z.string().default("https://financingsoft.github.io,http://localhost:8081,http://127.0.0.1:8081"),
  SMS_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  SMS_GATEWAY_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SMS_GATEWAY_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional())
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production") {
    if (value.BETTER_AUTH_SECRET.startsWith("replace-with-")) {
      context.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "Replace the example secret before production deployment." });
    }
    if (value.SMS_ENABLED && (!value.SMS_GATEWAY_URL || !value.SMS_GATEWAY_TOKEN)) {
      context.addIssue({ code: "custom", path: ["SMS_GATEWAY_URL"], message: "Production requires SMS_GATEWAY_URL and SMS_GATEWAY_TOKEN when SMS_ENABLED=true." });
    }
    if (value.SMS_ENABLED && value.SMS_GATEWAY_URL && !value.SMS_GATEWAY_URL.startsWith("https://")) {
      context.addIssue({ code: "custom", path: ["SMS_GATEWAY_URL"], message: "Production SMS_GATEWAY_URL must use HTTPS." });
    }
  }
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export interface WorkerBindings {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  APP_ORIGINS?: string;
  SMS_ENABLED?: string;
  SMS_GATEWAY_URL?: string;
  SMS_GATEWAY_TOKEN?: string;
}

export function parseEnvironment(bindings: WorkerBindings): AppEnvironment {
  return environmentSchema.parse(bindings);
}
