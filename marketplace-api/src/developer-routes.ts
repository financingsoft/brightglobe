import { Hono, type Context } from "hono";
import { z } from "zod";

export type DeveloperMemberRole = "admin" | "release_manager" | "analyst" | "support_readonly";

export interface DeveloperRequestIdentity {
  canonicalUserId: string;
  /** Non-null only when the server has verified the Better Auth email session. */
  verifiedEmail: string | null;
  displayName: string;
}

export interface DeveloperOrganizationRecord {
  id: string;
  slug: string;
  displayName: string;
  status: string;
  verificationStatus: string;
  createdAt: Date;
}

export interface DeveloperInvitationRecord {
  invitationId: string;
  rawToken: string;
  expiresAt: Date;
  organizationName: string;
}

export interface DeveloperTransactionService {
  createOrganization(input: {
    actorCanonicalUserId: string;
    slug: string;
    displayName: string;
    description?: string | null;
    websiteUrl?: string | null;
    supportEmail?: string | null;
  }): Promise<DeveloperOrganizationRecord>;
  createInvitation(input: {
    developerId: string;
    actorCanonicalUserId: string;
    email: string;
    role: DeveloperMemberRole;
  }): Promise<DeveloperInvitationRecord>;
  initiateOwnerTransfer(input: {
    developerId: string;
    actorCanonicalUserId: string;
    email: string;
  }): Promise<DeveloperInvitationRecord>;
  acceptInvitation(input: {
    rawToken: string;
    canonicalUserId: string;
    verifiedEmail: string;
  }): Promise<{ developerId: string; role: string; ownerTransferred: boolean }>;
  revokeInvitation(input: {
    developerId: string;
    invitationId: string;
    actorCanonicalUserId: string;
  }): Promise<{ invitationId: string; revokedAt: Date }>;
}

export interface DeveloperInvitationDelivery {
  send(input: {
    recipientEmail: string;
    organizationName: string;
    role: string;
    rawToken: string;
    expiresAt: Date;
    kind: "membership" | "owner_transfer";
  }): Promise<void>;
}

export interface DeveloperRouteDependencies {
  resolveIdentity(request: Request): Promise<DeveloperRequestIdentity | null>;
  transactions: DeveloperTransactionService;
  invitationDelivery: DeveloperInvitationDelivery;
  /** Cloudflare Rate Limiting binding; absent only in isolated unit tests. */
  rateLimit?(keys: string[]): Promise<boolean>;
}

const organizationSchema = z.object({
  slug: z.string().trim().min(3).max(100),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).optional(),
  websiteUrl: z.string().url().max(2048).optional(),
  supportEmail: z.string().email().max(320).optional()
}).strict();

const invitationSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["admin", "release_manager", "analyst", "support_readonly"])
}).strict();

const ownerTransferSchema = z.object({
  email: z.string().email().max(320)
}).strict();

const acceptInvitationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i)
}).strict();

const uuidSchema = z.string().uuid();

function getRequestId(request: Request): string {
  const supplied = request.headers.get("X-Request-Id");
  return supplied && /^[A-Za-z0-9._-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function respond(
  context: Context,
  body: unknown,
  status = 200,
  requestId = getRequestId(context.req.raw)
) {
  return context.json(body, status as 200, {
    "Cache-Control": "private, no-store, max-age=0",
    "Pragma": "no-cache",
    "Vary": "Cookie, Authorization",
    "X-Request-Id": requestId
  });
}

function serviceError(error: unknown): { status: number; code: string; message: string } | null {
  if (!(error instanceof Error) || !("code" in error)) return null;
  const code = String((error as Error & { code: unknown }).code);
  const mapped: Record<string, { status: number; message: string }> = {
    INVALID_INPUT: { status: 400, message: error.message },
    NOT_FOUND: { status: 404, message: "The requested developer resource was not found." },
    FORBIDDEN: { status: 403, message: "You do not have permission to perform this action." },
    CONFLICT: { status: 409, message: error.message },
    INVITATION_INVALID: { status: 404, message: "The invitation is invalid, expired or already used." },
    INVITATION_EMAIL_MISMATCH: { status: 403, message: "Sign in with the verified email address that received this invitation." }
  };
  const result = mapped[code];
  return result ? { status: result.status, code, message: result.message } : null;
}

async function readIdentity(
  dependencies: DeveloperRouteDependencies,
  request: Request
): Promise<DeveloperRequestIdentity | null> {
  return dependencies.resolveIdentity(request);
}

async function enforceRateLimit(
  context: Context,
  dependencies: DeveloperRouteDependencies,
  identity: DeveloperRequestIdentity,
  developerId?: string
): Promise<Response | null> {
  if (!dependencies.rateLimit) return null;
  const keys = ["user:" + identity.canonicalUserId + ":developer-write"];
  if (developerId) keys.push("organization:" + developerId + ":developer-write");
  try {
    const allowed = await dependencies.rateLimit(keys);
    if (!allowed) return respond(context, {
      error: { code: "RATE_LIMITED", message: "Too many developer-platform requests. Try again later." }
    }, 429);
    return null;
  } catch {
    return respond(context, {
      error: { code: "RATE_LIMIT_UNAVAILABLE", message: "The developer platform is temporarily unavailable." }
    }, 503);
  }
}

export function createDeveloperRoutes(dependencies: DeveloperRouteDependencies) {
  const routes = new Hono();

  routes.use("*", async (context, next) => {
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Pragma", "no-cache");
    context.header("Vary", "Cookie, Authorization");
    context.header("X-Request-Id", getRequestId(context.req.raw));
    await next();
  });

  routes.post("/developers", async (context) => {
    const requestId = getRequestId(context.req.raw);
    try {
      const identity = await readIdentity(dependencies, context.req.raw);
      if (!identity) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401, requestId);
      const limited = await enforceRateLimit(context, dependencies, identity);
      if (limited) return limited;
      const parsed = organizationSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success) return respond(context, { error: { code: "INVALID_REQUEST", message: "The developer organization details are invalid." } }, 400, requestId);
      const organization = await dependencies.transactions.createOrganization({
        actorCanonicalUserId: identity.canonicalUserId,
        ...parsed.data
      });
      return respond(context, {
        data: {
          id: organization.id,
          slug: organization.slug,
          displayName: organization.displayName,
          status: organization.status,
          verificationStatus: organization.verificationStatus,
          createdAt: organization.createdAt.toISOString()
        }
      }, 201, requestId);
    } catch (error) {
      const mapped = serviceError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status, requestId);
      console.error("[globe-play] Developer organization creation failed", { requestId });
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." } }, 500, requestId);
    }
  });

  routes.post("/developers/:developerId/invitations", async (context) => {
    const requestId = getRequestId(context.req.raw);
    let created: DeveloperInvitationRecord | null = null;
    const identity = await readIdentity(dependencies, context.req.raw).catch(() => null);
    if (!identity) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401, requestId);
    const developerId = context.req.param("developerId");
    if (!uuidSchema.safeParse(developerId).success) return respond(context, { error: { code: "INVALID_DEVELOPER_ID", message: "The developer ID is invalid." } }, 400, requestId);
    const limited = await enforceRateLimit(context, dependencies, identity, developerId);
    if (limited) return limited;
    const parsed = invitationSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return respond(context, { error: { code: "INVALID_REQUEST", message: "The invitation details are invalid." } }, 400, requestId);

    try {
      created = await dependencies.transactions.createInvitation({
        developerId,
        actorCanonicalUserId: identity.canonicalUserId,
        ...parsed.data
      });
      try {
        await dependencies.invitationDelivery.send({
          recipientEmail: parsed.data.email,
          organizationName: created.organizationName,
          role: parsed.data.role,
          rawToken: created.rawToken,
          expiresAt: created.expiresAt,
          kind: "membership"
        });
      } catch {
        try {
          await dependencies.transactions.revokeInvitation({
            developerId,
            invitationId: created.invitationId,
            actorCanonicalUserId: identity.canonicalUserId
          });
          return respond(context, { error: { code: "INVITATION_DELIVERY_FAILED", message: "The invitation could not be delivered and has been revoked." } }, 503, requestId);
        } catch {
          console.error("[globe-play] Invitation delivery failed and compensating revocation also failed", { requestId, invitationId: created.invitationId });
          return respond(context, { error: { code: "INVITATION_REVOCATION_REQUIRED", message: "The invitation delivery failed. The invitation may remain pending and requires operator attention." } }, 503, requestId);
        }
      }
      return respond(context, {
        data: { invitationId: created.invitationId, expiresAt: created.expiresAt.toISOString(), delivery: "sent" }
      }, 201, requestId);
    } catch (error) {
      const mapped = serviceError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status, requestId);
      console.error("[globe-play] Developer invitation creation failed", { requestId });
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." } }, 500, requestId);
    }
  });

  routes.post("/developers/:developerId/owner-transfer", async (context) => {
    const requestId = getRequestId(context.req.raw);
    const identity = await readIdentity(dependencies, context.req.raw).catch(() => null);
    if (!identity) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401, requestId);
    if (!identity.verifiedEmail) return respond(context, { error: { code: "VERIFIED_EMAIL_REQUIRED", message: "A verified email session is required to initiate an ownership transfer." } }, 403, requestId);
    const developerId = context.req.param("developerId");
    if (!uuidSchema.safeParse(developerId).success) return respond(context, { error: { code: "INVALID_DEVELOPER_ID", message: "The developer ID is invalid." } }, 400, requestId);
    const limited = await enforceRateLimit(context, dependencies, identity, developerId);
    if (limited) return limited;
    const parsed = ownerTransferSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return respond(context, { error: { code: "INVALID_REQUEST", message: "The owner transfer details are invalid." } }, 400, requestId);

    try {
      const created = await dependencies.transactions.initiateOwnerTransfer({
        developerId,
        actorCanonicalUserId: identity.canonicalUserId,
        email: parsed.data.email
      });
      try {
        await dependencies.invitationDelivery.send({
          recipientEmail: parsed.data.email,
          organizationName: created.organizationName,
          role: "owner",
          rawToken: created.rawToken,
          expiresAt: created.expiresAt,
          kind: "owner_transfer"
        });
      } catch {
        try {
          await dependencies.transactions.revokeInvitation({
            developerId,
            invitationId: created.invitationId,
            actorCanonicalUserId: identity.canonicalUserId
          });
          return respond(context, { error: { code: "INVITATION_DELIVERY_FAILED", message: "The owner-transfer invitation could not be delivered and has been revoked." } }, 503, requestId);
        } catch {
          console.error("[globe-play] Owner-transfer delivery failed and compensating revocation also failed", { requestId, invitationId: created.invitationId });
          return respond(context, { error: { code: "INVITATION_REVOCATION_REQUIRED", message: "The owner-transfer invitation delivery failed. The invitation may remain pending and requires operator attention." } }, 503, requestId);
        }
      }
      return respond(context, {
        data: { invitationId: created.invitationId, expiresAt: created.expiresAt.toISOString(), delivery: "sent" }
      }, 201, requestId);
    } catch (error) {
      const mapped = serviceError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status, requestId);
      console.error("[globe-play] Owner transfer initiation failed", { requestId });
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." } }, 500, requestId);
    }
  });

  routes.post("/invitations/accept", async (context) => {
    const requestId = getRequestId(context.req.raw);
    const identity = await readIdentity(dependencies, context.req.raw).catch(() => null);
    if (!identity) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401, requestId);
    if (!identity.verifiedEmail) return respond(context, { error: { code: "VERIFIED_EMAIL_REQUIRED", message: "A verified email session is required to accept this invitation." } }, 403, requestId);
    const limited = await enforceRateLimit(context, dependencies, identity);
    if (limited) return limited;
    const parsed = acceptInvitationSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return respond(context, { error: { code: "INVALID_REQUEST", message: "The invitation token is invalid." } }, 400, requestId);
    try {
      const result = await dependencies.transactions.acceptInvitation({
        rawToken: parsed.data.token,
        canonicalUserId: identity.canonicalUserId,
        verifiedEmail: identity.verifiedEmail
      });
      return respond(context, { data: result }, 200, requestId);
    } catch (error) {
      const mapped = serviceError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status, requestId);
      console.error("[globe-play] Invitation acceptance failed", { requestId });
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." } }, 500, requestId);
    }
  });

  routes.delete("/developers/:developerId/invitations/:invitationId", async (context) => {
    const requestId = getRequestId(context.req.raw);
    const identity = await readIdentity(dependencies, context.req.raw).catch(() => null);
    if (!identity) return respond(context, { error: { code: "UNAUTHORIZED", message: "A valid BrightGlobe session is required." } }, 401, requestId);
    const developerId = context.req.param("developerId");
    const invitationId = context.req.param("invitationId");
    const limited = await enforceRateLimit(context, dependencies, identity, developerId);
    if (limited) return limited;
    if (!uuidSchema.safeParse(developerId).success || !uuidSchema.safeParse(invitationId).success) {
      return respond(context, { error: { code: "INVALID_RESOURCE_ID", message: "The resource ID is invalid." } }, 400, requestId);
    }
    try {
      const result = await dependencies.transactions.revokeInvitation({
        developerId,
        invitationId,
        actorCanonicalUserId: identity.canonicalUserId
      });
      return respond(context, { data: { invitationId: result.invitationId, revokedAt: result.revokedAt.toISOString() } }, 200, requestId);
    } catch (error) {
      const mapped = serviceError(error);
      if (mapped) return respond(context, { error: { code: mapped.code, message: mapped.message } }, mapped.status, requestId);
      console.error("[globe-play] Invitation revocation failed", { requestId });
      return respond(context, { error: { code: "INTERNAL_SERVER_ERROR", message: "The request could not be completed." } }, 500, requestId);
    }
  });

  routes.notFound((context) => respond(context, { error: { code: "NOT_FOUND", message: "The requested endpoint does not exist." } }, 404));
  return routes;
}
