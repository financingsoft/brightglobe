import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeveloperInvitationEmail,
  createResendDeveloperInvitationDelivery
} from "./developer-invitation-email.js";

const input = {
  recipientEmail: "member@example.com",
  organizationName: "<Example & Co>",
  role: "release_manager",
  rawToken: "a".repeat(64),
  expiresAt: new Date("2026-11-24T00:00:00.000Z"),
  kind: "membership" as const
};

test("invitation token is delivered only in the URL fragment, not path or query", () => {
  const message = buildDeveloperInvitationEmail(input, {
    from: "BrightGlobe <noreply@go.globeapps.com>",
    linkOrigin: "https://test.globeapps.com"
  });
  const link = message.text.split("\n").find((line) => line.startsWith("Open this link:"))?.slice("Open this link: ".length);
  assert.ok(link);
  const parsed = new URL(link);
  assert.equal(parsed.pathname, "/invitations/accept");
  assert.equal(parsed.search, "");
  assert.equal(parsed.hash, "#token=" + "a".repeat(64));
  assert.match(message.html, /&lt;Example &amp; Co&gt;/);
  assert.equal(message.html.includes(input.organizationName), false);
});

test("invitation link origin must be a clean HTTPS origin", () => {
  assert.throws(() => buildDeveloperInvitationEmail(input, {
    from: "BrightGlobe <noreply@go.globeapps.com>",
    linkOrigin: "http://test.globeapps.com"
  }));
  assert.throws(() => buildDeveloperInvitationEmail(input, {
    from: "BrightGlobe <noreply@go.globeapps.com>",
    linkOrigin: "https://test.globeapps.com/extra"
  }));
});

test("Resend delivery sends a message and never exposes provider response details", async () => {
  let captured: RequestInit | undefined;
  const delivery = createResendDeveloperInvitationDelivery({
    apiKey: "test-secret",
    from: "BrightGlobe <noreply@go.globeapps.com>",
    linkOrigin: "https://test.globeapps.com",
    fetcher: async (_input, init) => {
      captured = init;
      return new Response("{}", { status: 200 });
    }
  });
  await delivery.send(input);
  assert.equal(captured?.method, "POST");
  assert.match(String((captured?.headers as Record<string, string>).Authorization), /^Bearer test-secret$/);
  const body = JSON.parse(String(captured?.body));
  assert.deepEqual(body.to, [input.recipientEmail]);
  assert.equal(body.html.includes(input.rawToken), true);
});

test("provider failures are surfaced without logging sensitive payloads", async () => {
  const delivery = createResendDeveloperInvitationDelivery({
    apiKey: "test-secret",
    from: "BrightGlobe <noreply@go.globeapps.com>",
    linkOrigin: "https://test.globeapps.com",
    fetcher: async () => new Response("sensitive provider body", { status: 503 })
  });
  await assert.rejects(() => delivery.send(input), /HTTP 503/);
});
