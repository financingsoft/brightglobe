import assert from "node:assert/strict";
import test from "node:test";
import { createDeveloperAppRoutes, type DeveloperAppRouteDependencies } from "./developer-app-routes.js";

const user = { canonicalUserId: "018f47b2-5c20-7a00-8000-000000000001" };
const developerId = "018f47b2-5c20-7a00-8000-000000000002";
const appId = "018f47b2-5c20-7a00-8000-000000000003";

function setup(overrides: Partial<DeveloperAppRouteDependencies> = {}) {
  const calls: string[] = [];
  const base: DeveloperAppRouteDependencies = {
    resolveIdentity: async () => user,
    apps: {
      listCategories: async (input) => { calls.push("categories:" + input.locale); return []; },
      listApps: async (input) => { calls.push("list:" + input.developerId); return []; },
      getApp: async (input) => { calls.push("get:" + input.appId); return { id: appId, status: "draft" }; },
      createApp: async (input) => { calls.push("create:" + input.actorCanonicalUserId); return { id: appId, status: "draft" }; },
      updateAppDraft: async (input) => { calls.push("update:" + input.locale); return { appId, locale: input.locale }; }
    }
  };
  return { app: createDeveloperAppRoutes({ ...base, ...overrides }), calls };
}

test("category catalogue is authenticated, localized and private no-store", async () => {
  const { app, calls } = setup();
  const response = await app.request("/developers/" + developerId + "/categories?locale=zh-CN");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.deepEqual(calls, ["categories:zh-CN"]);
});

test("category catalogue rejects malformed locale", async () => {
  const { app, calls } = setup();
  const response = await app.request("/developers/" + developerId + "/categories?locale=../../private");
  assert.equal(response.status, 400);
  assert.deepEqual(calls, []);
});

test("app list is authenticated, tenant-scoped and private no-store", async () => {
  const { app, calls } = setup();
  const response = await app.request("/developers/" + developerId + "/apps");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.deepEqual(calls, ["list:" + developerId]);
});

test("anonymous app creation is rejected before the transaction service", async () => {
  const { app, calls } = setup({ resolveIdentity: async () => null });
  const response = await app.request("/developers/" + developerId + "/apps", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "sample-game", appType: "game", platforms: ["android"], localizations: [{ locale: "en", name: "Sample", description: "A sample game." }] })
  });
  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
});

test("app draft creation validates localized payload and never accepts more than three categories", async () => {
  const { app, calls } = setup();
  const response = await app.request("/developers/" + developerId + "/apps", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: "sample-game", appType: "game", platforms: ["android", "ios"],
      categoryIds: [appId, developerId, user.canonicalUserId, "018f47b2-5c20-7a00-8000-000000000004"],
      localizations: [{ locale: "en", name: "Sample", description: "A sample game." }]
    })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(calls, []);
});

test("valid app draft creation passes the server-resolved canonical identity", async () => {
  const { app, calls } = setup();
  const response = await app.request("/developers/" + developerId + "/apps", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: "sample-game", appType: "game", platforms: ["android", "ios"],
      localizations: [
        { locale: "en", name: "Sample Game", description: "English description." },
        { locale: "zh-CN", name: "示例游戏", description: "简体中文介绍。" }
      ]
    })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(calls, ["create:" + user.canonicalUserId]);
});

test("draft localization updates are scoped to the requested locale", async () => {
  const { app, calls } = setup();
  const response = await app.request("/developers/" + developerId + "/apps/" + appId + "/localizations/zh-CN", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "示例应用", description: "更新后的中文介绍。" })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["update:zh-CN"]);
});

test("invalid app identifiers are non-enumerating 404s", async () => {
  const { app, calls } = setup();
  const response = await app.request("/developers/not-a-uuid/apps");
  assert.equal(response.status, 404);
  assert.deepEqual(calls, []);
});
