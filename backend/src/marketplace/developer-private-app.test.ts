import assert from "node:assert/strict";
import test from "node:test";
import { createDeveloperPrivateApp } from "./developer-private-app.js";
import type { DeveloperRouteDependencies } from "./developer-routes.js";

const user = {
  canonicalUserId: "018f47b2-5c20-7a00-8000-000000000001",
  verifiedEmail: "owner@example.com",
  displayName: "Publisher Owner"
};
const developerId = "018f47b2-5c20-7a00-8000-000000000002";

function createApp(options: {
  allowed?: boolean;
  rateAllowed?: boolean;
  contentType?: string;
} = {}) {
  const calls: string[] = [];
  const dependencies: DeveloperRouteDependencies = {
    resolveIdentity: async () => user,
    transactions: {
      listOrganizations: async () => [],
      getWorkspace: async () => { throw new Error("not used"); },
      createOrganization: async (input) => {
        calls.push("created:" + input.actorCanonicalUserId);
        return {
          id: developerId,
          slug: input.slug,
          displayName: input.displayName,
          status: "pending",
          verificationStatus: "unverified",
          createdAt: new Date("2026-11-17T00:00:00.000Z")
        };
      },
      createInvitation: async () => { throw new Error("not used"); },
      initiateOwnerTransfer: async () => { throw new Error("not used"); },
      acceptInvitation: async () => { throw new Error("not used"); },
      revokeInvitation: async () => { throw new Error("not used"); }
    },
    invitationDelivery: { send: async () => undefined },
    rateLimit: async () => true
  };
  const app = createDeveloperPrivateApp({
    dependencies,
    appDependencies,
    allowedOrigins: ["https://test.globeapps.com"],
    rateLimiter: { limit: async () => ({ success: options.rateAllowed !== false }) }
  });
  return { app, calls };
}

test("private API rejects missing or untrusted Origin before identity resolution", async () => {
  const { app, calls } = createApp();
  const response = await app.request("/api/v1/play/developers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "example-publisher", displayName: "Example Publisher" })
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.deepEqual(calls, []);
});

test("private API rejects non-JSON mutations", async () => {
  const { app, calls } = createApp();
  const response = await app.request("/api/v1/play/developers", {
    method: "POST",
    headers: { Origin: "https://test.globeapps.com", "Content-Type": "text/plain" },
    body: "{}"
  });
  assert.equal(response.status, 415);
  assert.deepEqual(calls, []);
});

test("private API rejects oversized mutation payloads before route execution", async () => {
  const { app, calls } = createApp();
  const response = await app.request("/api/v1/play/developers", {
    method: "POST",
    headers: {
      Origin: "https://test.globeapps.com",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.10"
    },
    body: JSON.stringify({ slug: "example-publisher", displayName: "x".repeat(40000) })
  });
  assert.equal(response.status, 413);
  assert.deepEqual(calls, []);
});

test("private developer workspace reads are rate limited by edge client IP", async () => {
  const { app } = createApp({ rateAllowed: false });
  const response = await app.request("/api/v1/play/developers", {
    headers: { "CF-Connecting-IP": "192.0.2.10" }
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
});

test("private API rate limits by edge client IP", async () => {
  const { app, calls } = createApp({ rateAllowed: false });
  const response = await app.request("/api/v1/play/developers", {
    method: "POST",
    headers: {
      Origin: "https://test.globeapps.com",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.10"
    },
    body: JSON.stringify({ slug: "example-publisher", displayName: "Example Publisher" })
  });
  assert.equal(response.status, 429);
  assert.deepEqual(calls, []);
});

test("private API returns no-store and reaches the canonical route module for allowed requests", async () => {
  const { app, calls } = createApp();
  const response = await app.request("/api/v1/play/developers", {
    method: "POST",
    headers: {
      Origin: "https://test.globeapps.com",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.10"
    },
    body: JSON.stringify({ slug: "example-publisher", displayName: "Example Publisher" })
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.deepEqual(calls, ["created:" + user.canonicalUserId]);
});
