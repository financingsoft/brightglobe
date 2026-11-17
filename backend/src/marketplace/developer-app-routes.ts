import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppPlatform, AppLocalizationInput } from "../services/marketplace-apps.js";

export interface DeveloperAppTransactionService {
  listApps(input: { developerId: string; actorCanonicalUserId: string }): Promise<unknown[]>;
  getApp(input: { developerId: string; appId: string; actorCanonicalUserId: string }): Promise<unknown>;
  createApp(input: {
    developerId: string; actorCanonicalUserId: string; slug: string; appType: "app" | "game";
    localizations: AppLocalizationInput[]; categoryIds?: string[]; platforms: AppPlatform[];
  }): Promise<unknown>;
  updateAppDraft(input: {
    developerId: string; appId: string; actorCanonicalUserId: string; locale: string;
    listing: Omit<AppLocalizationInput, "locale">; categoryIds?: string[]; platforms?: AppPlatform[]; slug?: string;
  }): Promise<unknown>;
}

export interface DeveloperAppRouteDependencies {
  resolveIdentity(request: Request): Promise<{ canonicalUserId: string } | null>;
  apps: DeveloperAppTransactionService;
  rateLimit?(keys: string[]): Promise<boolean>;
}

const platformSchema = z.enum(["android", "ios", "web", "windows", "macos", "linux"]);
const localizationSchema = z.object({
  locale: z.string().min(2).max(35),
  name: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(240).nullable().optional(),
  description: z.string().trim().min(1).max(20000),
  websiteUrl: z.string().url().max(2048).nullable().optional(),
  privacyPolicyUrl: z.string().url().max(2048).nullable().optional(),
  supportUrl: z.string().url().max(2048).nullable().optional()
}).strict();
const createSchema = z.object({
  slug: z.string().trim().min(3).max(140),
  appType: z.enum(["app", "game"]),
  localizations: z.array(localizationSchema).min(1).max(8),
  categoryIds: z.array(z.string().uuid()).max(3).optional(),
  platforms: z.array(platformSchema).min(1).max(6)
}).strict();
const updateSchema = z.object({
  slug: z.string().trim().min(3).max(140).optional(),
  name: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(240).nullable().optional(),
  description: z.string().trim().min(1).max(20000),
  websiteUrl: z.string().url().max(2048).nullable().optional(),
  privacyPolicyUrl: z.string().url().max(2048).nullable().optional(),
  supportUrl: z.string().url().max(2048).nullable().optional(),
  categoryIds: z.array(z.string().uuid()).max(3).optional(),
  platforms: z.array(platformSchema).min(1).max(6).optional()
}).strict();
const uuid = z.string().uuid();

function respond(context: Context, body: unknown, status = 200) {
  return context.json(body, status as 200, {
    "Cache-Control": "private, no-store, max-age=0",
    "Pragma": "no-cache",
    "Vary": "Origin, Cookie, Authorization"
  });
}

function mapError(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) return null;
  const code = String((error as Error & { code: unknown }).code);
  const map: Record<string, { status: number; message: string }> = {
    INVALID_INPUT: { status: 400, message: error.message },
    NOT_FOUND: { status: 404, message: "The requested app or developer organization was not found." },
    FORBIDDEN: { status: 403, message: "You do not have permission to manage this app." },
    CONFLICT: { status: 409, message: error.message }
  };
  return map[code] ? { code, ...map[code] } : null;
}

async function identity(context: Context, dependencies: DeveloperAppRouteDependencies) {
  return dependencies.resolveIdentity(context.req.raw).catch(() => null);
}

async function limited(context: Context, dependencies: DeveloperAppRouteDependencies, userId: string, developerId: string, scope: string) {
  if (!dependencies.rateLimit) return null;
  try {
    return await dependencies.rateLimit([
      "user:" + userId + ":developer-app-" + scope,
      "organization:" + developerId + ":developer-app-" + scope
    ]) ? null : respond(context, { error: { code: "RATE_LIMITED", message: "Too many app-management requests. Try again later." } }, 429);
  } catch {
    return respond(context, { error: { code: "RATE_LIMIT_UNAVAILABLE", message: "The developer platform is temporarily unavailable." } }, 503);
  }
}

export function createDeveloperAppRoutes(dependencies: DeveloperAppRouteDependencies) {
  const routes = new Hono();

  routes.get("/developers/:developerId/apps", async (context) => {
    const developerId = context.req.param("developerId");
    if (!uuid.safeParse(developerId).success) return respond(context, { error: { code: "NOT_FOUND", message: "Developer organization was not found." } }, 404);
    const actor = await identity(context, dependencies);
    if (!actor) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401);
    const rate = await limited(context, dependencies, actor.canonicalUserId, developerId, "read");
    if (rate) return rate;
    try {
      return respond(context, { data: await dependencies.apps.listApps({ developerId, actorCanonicalUserId: actor.canonicalUserId }) });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status);
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." } }, 500);
    }
  });

  routes.post("/developers/:developerId/apps", async (context) => {
    const developerId = context.req.param("developerId");
    if (!uuid.safeParse(developerId).success) return respond(context, { error: { code: "NOT_FOUND", message: "Developer organization was not found." } }, 404);
    const actor = await identity(context, dependencies);
    if (!actor) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401);
    const rate = await limited(context, dependencies, actor.canonicalUserId, developerId, "write");
    if (rate) return rate;
    const parsed = createSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return respond(context, { error: { code: "INVALID_INPUT", message: "App draft details are invalid." } }, 400);
    try {
      const data = await dependencies.apps.createApp({
        developerId, actorCanonicalUserId: actor.canonicalUserId, ...parsed.data
      });
      return respond(context, { data }, 201);
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status);
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The app draft could not be created." } }, 500);
    }
  });

  routes.get("/developers/:developerId/apps/:appId", async (context) => {
    const developerId = context.req.param("developerId");
    const appId = context.req.param("appId");
    if (!uuid.safeParse(developerId).success || !uuid.safeParse(appId).success) return respond(context, { error: { code: "NOT_FOUND", message: "App was not found." } }, 404);
    const actor = await identity(context, dependencies);
    if (!actor) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401);
    const rate = await limited(context, dependencies, actor.canonicalUserId, developerId, "read");
    if (rate) return rate;
    try {
      return respond(context, { data: await dependencies.apps.getApp({ developerId, appId, actorCanonicalUserId: actor.canonicalUserId }) });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status);
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." } }, 500);
    }
  });

  routes.patch("/developers/:developerId/apps/:appId/localizations/:locale", async (context) => {
    const developerId = context.req.param("developerId");
    const appId = context.req.param("appId");
    const locale = context.req.param("locale");
    if (!uuid.safeParse(developerId).success || !uuid.safeParse(appId).success) return respond(context, { error: { code: "NOT_FOUND", message: "App was not found." } }, 404);
    const actor = await identity(context, dependencies);
    if (!actor) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401);
    const rate = await limited(context, dependencies, actor.canonicalUserId, developerId, "write");
    if (rate) return rate;
    const parsed = updateSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return respond(context, { error: { code: "INVALID_INPUT", message: "Localized app details are invalid." } }, 400);
    try {
      const { slug, categoryIds, platforms, ...listing } = parsed.data;
      const data = await dependencies.apps.updateAppDraft({
        developerId, appId, actorCanonicalUserId: actor.canonicalUserId,
        locale, listing, ...(slug ? { slug } : {}),
        ...(categoryIds ? { categoryIds } : {}), ...(platforms ? { platforms: platforms as AppPlatform[] } : {})
      });
      return respond(context, { data });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status);
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The app draft could not be updated." } }, 500);
    }
  });

  return routes;
}
