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
    listOrganizations: async () => [],
    getWorkspace: async () => { throw new Error("not used"); },
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

test("organization and workspace reads are authenticated, tenant-scoped and private no-store", async () => {
  const createdAt = new Date("2026-11-17T00:00:00.000Z");
  const base = dependencies();
  const transactions: DeveloperTransactionService = {
    ...base.transactions,
    listOrganizations: async (input) => {
      assert.equal(input.actorCanonicalUserId, user.canonicalUserId);
      return [{
        id: developerId,
        slug: "example-publisher",
        displayName: "Example Publisher",
        status: "pending",
        verificationStatus: "unverified",
        createdAt,
        role: "owner"
      }];
    },
    getWorkspace: async (input) => {
      assert.equal(input.developerId, developerId);
      assert.equal(input.actorCanonicalUserId, user.canonicalUserId);
      return {
        organization: {
          id: developerId,
          slug: "example-publisher",
          displayName: "Example Publisher",
          description: null,
          websiteUrl: null,
          supportEmail: null,
          status: "pending",
          verificationStatus: "unverified",
          createdAt,
          role: "owner"
        },
        members: [{
          canonicalUserId: user.canonicalUserId,
          displayName: "Publisher Owner",
          role: "owner",
          status: "active",
          createdAt
        }],
        invitations: [{
          id: invitationId,
          email: "member@example.com",
          role: "analyst",
          expiresAt: new Date("2026-11-24T00:00:00.000Z"),
          createdAt,
          canRevoke: true
        }]
      };
    }
  };
  const { app } = dependencies({ transactions });
  const listResponse = await app.request("/developers");
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.headers.get("Cache-Control"), "private, no-store, max-age=0");
  const listBody = await listResponse.json() as { data: Array<{ id: string; role: string; createdAt: string }> };
  assert.equal(listBody.data[0]?.id, developerId);
  assert.equal(listBody.data[0]?.role, "owner");
  assert.equal(listBody.data[0]?.createdAt, createdAt.toISOString());

  const workspaceResponse = await app.request("/developers/" + developerId);
  assert.equal(workspaceResponse.status, 200);
  assert.equal(workspaceResponse.headers.get("Cache-Control"), "private, no-store, max-age=0");
  const workspaceBody = await workspaceResponse.json() as {
    data: { members: Array<{ displayName: string }>; invitations: Array<{ email: string }> }
  };
  assert.equal(workspaceBody.data.members[0]?.displayName, "Publisher Owner");
  assert.equal(workspaceBody.data.invitations[0]?.email, "member@example.com");
});

test("workspace read endpoints are rate limited by canonical user", async () => {
  let keys: string[] = [];
  const { app } = dependencies({
    rateLimit: async (nextKeys) => { keys = nextKeys; return false; }
  });
  const response = await app.request("/developers");
  assert.equal(response.status, 429);
  assert.deepEqual(keys, ["user:" + user.canonicalUserId + ":developer-read"]);
});

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
  assert.equal(JSON.stringify(body).includes(invitation.rawToken), false);
});

test("generic member invitation endpoint cannot assign the Owner role", async () => {
  let created = false;
  const base = dependencies();
  const tx: DeveloperTransactionService = {
    ...base.transactions,
    createInvitation: async () => { created = true; return invitation; }
  };
  const { app } = dependencies({ transactions: tx });
  const response = await app.request(`/developers/${developerId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "new-owner@example.com", role: "owner" })
  });
  assert.equal(response.status, 400);
  assert.equal(created, false);
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

test("rate limits private mutations by canonical user and organization", async () => {
  const base = dependencies();
  let created = false;
  let keys: string[] = [];
  const { app } = dependencies({
    transactions: {
      ...base.transactions,
      createInvitation: async () => { created = true; return invitation; }
    },
    rateLimit: async (nextKeys) => { keys = nextKeys; return false; }
  });
  const response = await app.request(`/developers/${developerId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "member@example.com", role: "analyst" })
  });
  assert.equal(response.status, 429);
  assert.deepEqual(keys, [
    "user:" + user.canonicalUserId + ":developer-write",
    "organization:" + developerId + ":developer-write"
  ]);
  assert.equal(created, false);
});

test("owner-transfer email uses the organization display name from the transaction", async () => {
  let deliveredOrganization = "";
  const base = dependencies();
  const { app } = dependencies({
    transactions: {
      ...base.transactions,
      initiateOwnerTransfer: async () => invitation
    },
    invitationDelivery: {
      send: async (message) => { deliveredOrganization = message.organizationName; }
    }
  });
  const response = await app.request(`/developers/${developerId}/owner-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "new-owner@example.com" })
  });
  assert.equal(response.status, 201);
  assert.equal(deliveredOrganization, invitation.organizationName);
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
