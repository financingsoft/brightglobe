import { createAuth } from "./auth.js";
import { parseEnvironment, type WorkerBindings } from "./config/env.js";
import { parseOrigins } from "./config/origins.js";
import { createDatabase } from "./db/client.js";
import {
  acceptDeveloperInvitation, createDeveloperInvitation, createDeveloperOrganization,
  initiateDeveloperOwnerTransfer, listDeveloperOrganizations, getDeveloperWorkspace,
  revokeDeveloperInvitation
} from "./services/marketplace-developers.js";
import {
  createMarketplaceApp, getMarketplaceApp, listMarketplaceApps, updateMarketplaceAppDraft
} from "./services/marketplace-apps.js";
import { resolveDeveloperRequestIdentity } from "./marketplace/developer-identity.js";
import { createResendDeveloperInvitationDelivery } from "./marketplace/developer-invitation-email.js";
import { createDeveloperPrivateApp, type DeveloperRateLimitBinding } from "./marketplace/developer-private-app.js";

interface MarketplacePrivateBindings extends WorkerBindings {
  DEVELOPER_PORTAL_ORIGINS?: string;
  DEVELOPER_API_PATH_PREFIX?: string;
  DEVELOPER_INVITATION_LINK_ORIGIN?: string;
  DEVELOPER_INVITATION_RESEND_API_KEY?: string;
  DEVELOPER_INVITATION_EMAIL_FROM?: string;
  DEVELOPER_RATE_LIMITER?: DeveloperRateLimitBinding;
}

function readPrivateConfiguration(bindings: MarketplacePrivateBindings) {
  const env = parseEnvironment(bindings);
  const allowedOrigins = parseOrigins(bindings.DEVELOPER_PORTAL_ORIGINS ?? "");
  const apiPathPrefix = bindings.DEVELOPER_API_PATH_PREFIX?.trim() ?? "";
  const linkOriginValue = bindings.DEVELOPER_INVITATION_LINK_ORIGIN?.trim() ?? "";
  const apiKey = bindings.DEVELOPER_INVITATION_RESEND_API_KEY?.trim() ?? "";
  const from = bindings.DEVELOPER_INVITATION_EMAIL_FROM?.trim() ?? "";
  if (allowedOrigins.length === 0) throw new Error("DEVELOPER_PORTAL_ORIGINS is required.");
  if (!/^\/[a-z0-9/_-]+$/.test(apiPathPrefix) || apiPathPrefix.endsWith("/") || apiPathPrefix.includes("//") || apiPathPrefix.includes("..")) {
    throw new Error("DEVELOPER_API_PATH_PREFIX must be a normalized absolute path prefix.");
  }
  if (!linkOriginValue || !apiKey || !from) throw new Error("Developer invitation email configuration is incomplete.");
  const linkOrigin = new URL(linkOriginValue);
  if (linkOrigin.protocol !== "https:" || linkOrigin.username || linkOrigin.password ||
      linkOrigin.pathname !== "/" || linkOrigin.search || linkOrigin.hash || !allowedOrigins.includes(linkOrigin.origin)) {
    throw new Error("DEVELOPER_INVITATION_LINK_ORIGIN must be one of the allowed HTTPS portal origins.");
  }
  if (!bindings.DEVELOPER_RATE_LIMITER) throw new Error("DEVELOPER_RATE_LIMITER binding is required; private mutations fail closed without it.");
  return { env, allowedOrigins, apiPathPrefix, linkOrigin: linkOrigin.origin, resendApiKey: apiKey, emailFrom: from, rateLimiter: bindings.DEVELOPER_RATE_LIMITER };
}

const worker = {
  async fetch(request: Request, bindings: MarketplacePrivateBindings): Promise<Response> {
    let configuration: ReturnType<typeof readPrivateConfiguration>;
    try {
      configuration = readPrivateConfiguration(bindings);
    } catch (error) {
      console.error("[globe-play-private] Invalid runtime configuration", { errorType: error instanceof Error ? error.name : "unknown" });
      return Response.json({ error: { code: "SERVICE_CONFIGURATION_ERROR", message: "The private developer service is not configured." } }, {
        status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" }
      });
    }
    const { db, pool } = createDatabase(configuration.env.DATABASE_URL);
    try {
      const auth = createAuth(db, configuration.env);
      const invitationDelivery = createResendDeveloperInvitationDelivery({
        apiKey: configuration.resendApiKey, from: configuration.emailFrom, linkOrigin: configuration.linkOrigin
      });
      const transactions = {
        listOrganizations: (input: { actorCanonicalUserId: string }) => listDeveloperOrganizations(db, input.actorCanonicalUserId),
        getWorkspace: (input: Parameters<typeof getDeveloperWorkspace>[1]) => getDeveloperWorkspace(db, input),
        createOrganization: (input: Parameters<typeof createDeveloperOrganization>[1]) => createDeveloperOrganization(db, input),
        createInvitation: (input: Parameters<typeof createDeveloperInvitation>[1]) => createDeveloperInvitation(db, input),
        initiateOwnerTransfer: (input: Parameters<typeof initiateDeveloperOwnerTransfer>[1]) => initiateDeveloperOwnerTransfer(db, input),
        acceptInvitation: (input: Parameters<typeof acceptDeveloperInvitation>[1]) => acceptDeveloperInvitation(db, input),
        revokeInvitation: (input: Parameters<typeof revokeDeveloperInvitation>[1]) => revokeDeveloperInvitation(db, input)
      };
      const appTransactions = {
        listApps: (input: Parameters<typeof listMarketplaceApps>[1]) => listMarketplaceApps(db, input),
        getApp: (input: Parameters<typeof getMarketplaceApp>[1]) => getMarketplaceApp(db, input),
        createApp: (input: Parameters<typeof createMarketplaceApp>[1]) => createMarketplaceApp(db, input),
        updateAppDraft: (input: Parameters<typeof updateMarketplaceAppDraft>[1]) => updateMarketplaceAppDraft(db, input)
      };
      const rateLimit = async (keys: string[]) => {
        for (const key of keys) {
          const result = await configuration.rateLimiter.limit({ key });
          if (!result.success) return false;
        }
        return true;
      };
      const app = createDeveloperPrivateApp({
        dependencies: {
          resolveIdentity: (incomingRequest) => resolveDeveloperRequestIdentity(db, auth, incomingRequest),
          transactions, invitationDelivery, rateLimit
        },
        appDependencies: {
          resolveIdentity: (incomingRequest) => resolveDeveloperRequestIdentity(db, auth, incomingRequest),
          apps: appTransactions, rateLimit
        },
        allowedOrigins: configuration.allowedOrigins,
        rateLimiter: configuration.rateLimiter
      });
      const incomingUrl = new URL(request.url);
      const prefix = configuration.apiPathPrefix;
      if (incomingUrl.pathname !== prefix && !incomingUrl.pathname.startsWith(prefix + "/")) {
        return Response.json({ error: { code: "NOT_FOUND", message: "The requested endpoint does not exist." } }, {
          status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" }
        });
      }
      incomingUrl.pathname = incomingUrl.pathname.slice(prefix.length) || "/";
      const rewrittenRequest = new Request(incomingUrl.toString(), request);
      return await app.fetch(rewrittenRequest);
    } catch (error) {
      console.error("[globe-play-private] Request failed", { errorType: error instanceof Error ? error.name : "unknown" });
      return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "The developer platform is temporarily unavailable." } }, {
        status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" }
      });
    } finally {
      await pool.end().catch((error: unknown) => {
        console.error("[globe-play-private] Database pool cleanup failed", { errorType: error instanceof Error ? error.name : "unknown" });
      });
    }
  }
};
export default worker;
