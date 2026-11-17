import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeveloperRoutes,
  type DeveloperInvitationRecord,
  type DeveloperRouteDependencies,
  type DeveloperTransactionService
} from "./developer-routes.js";

const user = {
  canonicalUserId: "018f47b2-5c20-7a00-8000-000000000001",
  verifiedEmail: "owner@example.com",
  displayName: "Publisher Owner"
};
const developerId = "018f47b2-5c20-7a00-8000-000000000002";
const invitationId = "018f47b2-5c20-7a00-8000-000000000003";
const invitation: DeveloperInvitationRecord = {
  invitationId,
  rawToken: "a".repeat(64),
  expiresAt: new Date("2026-11-24T00:00:00.000Z"),
  organizationName: "Example Publisher"
};

function dependencies(overrides: Partial<DeveloperRouteDependencies> = {}) {
  const calls: string[] = [];
  const transactions: DeveloperTransactionService = {
    createOrganization: async (input) => ({
      id: developerId,
      slug: input.slug,
      displayName: input.displayName,
      status: "pending",
      verificationStatus: "unverified",
      createdAt: new Date("2026-11-17T00:00:00.000Z")
    }),
    createInvitation: async () => invitation,
    initiateOwnerTransfer: async () => invitation,
    acceptInvitation: async () => ({ developerId, role: "admin", ownerTransferred: false }),
    revokeInvitation: async () => {
      calls.push("revoked");
      return { invitationId, revokedAt: new Date("2026-11-17T00:00:00.000Z") };
    }
  };
  const base: DeveloperRouteDependencies = {
    resolveIdentity: async () => user,
    transactions,
    invitationDelivery: { send: async () => { calls.push("sent"); } }
  };
  return {
    app: createDeveloperRoutes({ ...base, ...overrides }),
    calls,
    transactions
  };
}

test("organization creation is authenticated and always private no-store", async () => {
  const { app } = dependencies();
  const response = await app.request("/developers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "example-publisher", displayName: "Example Publisher" })
  });
  assert.equal(response.status, 201);
  assert.match(response.headers.get("Cache-Control") ?? "", /private, no-store/);
  assert.match(response.headers.get("Vary") ?? "", /Cookie/);
  const body = await response.json() as { data: { id: string; status: string } };
  assert.equal(body.data.id, developerId);
  assert.equal(body.data.status, "pending");
});

test("anonymous organization mutation is rejected without calling the service", async () => {
  let called = false;
  const { app } = dependencies({
    resolveIdentity: async () => null,
    transactions: {
      ...dependencies().transactions,
      createOrganization: async () => { called = true; throw new Error("must not run"); }
    }
  });
  const response = await app.request("/developers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "example-publisher", displayName: "Example Publisher" })
  });
  assert.equal(response.status, 401);
  assert.equal(called, false);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
});

test("member invitation excludes owner role and sends only after creation", async () => {
  const { app, calls } = dependencies();
  const response = await app.request(`/developers/${developerId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "member@example.com", role: "release_manager" })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(calls, ["sent"]);
  const body = await response.json() as { data: { invitationId: string; delivery: string } };
  assert.equal(body.data.invitationId, invitationId);
  assert.equal(body.data.delivery, "sent");
});

test("failed invitation delivery compensates by revoking the unusable invitation", async () => {
  const { app, calls } = dependencies({
    invitationDelivery: { send: async () => { throw new Error("provider unavailable"); } }
  });
  const response = await app.request(`/developers/${developerId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "member@example.com", role: "analyst" })
  });
  assert.equal(response.status, 503);
  assert.deepEqual(calls, ["revoked"]);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, "INVITATION_DELIVERY_FAILED");
});

test("reports operator attention if failed delivery cannot revoke the invitation", async () => {
  const base = dependencies();
  const tx: DeveloperTransactionService = {
    ...base.transactions,
    revokeInvitation: async () => { throw new Error("database unavailable"); }
  };
  const { app } = dependencies({
    transactions: tx,
    invitationDelivery: { send: async () => { throw new Error("provider unavailable"); } }
  });
  const response = await app.request(`/developers/${developerId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "member@example.com", role: "analyst" })
  });
  assert.equal(response.status, 503);
  const body = await response.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, "INVITATION_REVOCATION_REQUIRED");
  assert.match(body.error.message, /may remain pending/);
});

test("wallet-only owner cannot initiate an ownership transfer", async () => {
  let initiated = false;
  const base = dependencies();
  const tx: DeveloperTransactionService = {
    ...base.transactions,
    initiateOwnerTransfer: async () => { initiated = true; return invitation; }
  };
  const { app } = dependencies({
    resolveIdentity: async () => ({ ...user, verifiedEmail: null }),
    transactions: tx
  });
  const response = await app.request(`/developers/${developerId}/owner-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "new-owner@example.com" })
  });
  assert.equal(response.status, 403);
  assert.equal(initiated, false);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "VERIFIED_EMAIL_REQUIRED");
});

test("wallet-only identity cannot accept an invitation", async () => {
  const { app } = dependencies({
    resolveIdentity: async () => ({ ...user, verifiedEmail: null })
  });
  const response = await app.request("/invitations/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(64) })
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "VERIFIED_EMAIL_REQUIRED");
});

test("invitation token is accepted in POST body, never in URL", async () => {
  let acceptedToken = "";
  const base = dependencies();
  const tx: DeveloperTransactionService = {
    ...base.transactions,
    acceptInvitation: async (input) => {
      acceptedToken = input.rawToken;
      return { developerId, role: "admin", ownerTransferred: false };
    }
  };
  const { app } = dependencies({ transactions: tx });
  const response = await app.request("/invitations/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "b".repeat(64) })
  });
  assert.equal(response.status, 200);
  assert.equal(acceptedToken, "b".repeat(64));
});

test("all unhandled developer routes remain private and return a safe 404", async () => {
  const { app } = dependencies();
  const response = await app.request("/does-not-exist");
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
});
