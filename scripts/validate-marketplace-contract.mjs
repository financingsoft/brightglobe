#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const fail = [];
const requiredFiles = [
  "AGENTS.md",
  "docs/PLAY_MARKETPLACE_MASTER_CONTRACT.md",
  "docs/PLAY_ROUTE_POLICY_MANIFEST.json"
];
for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) fail.push("Missing required contract file: " + file);
}
if (fail.length) {
  console.error(fail.join("\n"));
  process.exit(1);
}

const read = (file) => readFileSync(resolve(root, file), "utf8");
const master = read("docs/PLAY_MARKETPLACE_MASTER_CONTRACT.md");
const agents = read("AGENTS.md");
const requiredMasterSections = [
  "Traffic, cache-first and database cost architecture",
  "SEO and Google Search requirements",
  "Globalization and localization",
  "Required verification and Definition of Done"
];
for (const section of requiredMasterSections) {
  if (!master.includes(section)) fail.push("Master contract missing required section: " + section);
}
for (const phrase of [
  "Mandatory preflight before EVERY development task",
  "Never make Neon the per-page-view read path",
  "Completion gate for every task",
  "PLAY_ROUTE_POLICY_MANIFEST.json"
]) {
  if (!agents.includes(phrase)) fail.push("AGENTS.md missing mandatory instruction: " + phrase);
}

let manifest;
try {
  manifest = JSON.parse(read("docs/PLAY_ROUTE_POLICY_MANIFEST.json"));
} catch (error) {
  fail.push("Route policy manifest is invalid JSON: " + error.message);
}
if (manifest) {
  if (manifest.contractVersion !== "1.0") fail.push("Unsupported route manifest contractVersion.");
  if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) fail.push("Route manifest must contain routes.");
  const ids = new Set();
  const patterns = new Set();
  for (const route of manifest.routes ?? []) {
    const label = route.id ?? "(missing id)";
    for (const key of ["id","pattern","surface","access","cache","seo","locale","cacheKey","invalidationTags"]) {
      if (!(key in route)) fail.push(label + ": missing " + key);
    }
    if (ids.has(route.id)) fail.push("Duplicate route id: " + route.id);
    ids.add(route.id);
    if (patterns.has(route.pattern)) fail.push("Duplicate route pattern: " + route.pattern);
    patterns.add(route.pattern);
    if (typeof route.pattern !== "string" || !route.pattern.startsWith("/")) fail.push(label + ": pattern must start with /");
    if (!["public","authenticated","privileged"].includes(route.access)) fail.push(label + ": invalid access class");
    if (!["public-edge","private-no-store"].includes(route.cache)) fail.push(label + ": invalid cache class");
    if (!["indexable","conditional","noindex"].includes(route.seo)) fail.push(label + ": invalid SEO class");
    if (!["path","none"].includes(route.locale)) fail.push(label + ": invalid locale strategy");
    if (!Array.isArray(route.cacheKey) || !Array.isArray(route.invalidationTags)) fail.push(label + ": cacheKey/invalidationTags must be arrays");
    if (route.cache === "public-edge") {
      if (route.access !== "public") fail.push(label + ": non-public route cannot use public-edge cache");
      if (!Number.isInteger(route.ttlSeconds) || route.ttlSeconds < 1) fail.push(label + ": public cache needs positive integer ttlSeconds");
      if (route.cacheKey.length === 0) fail.push(label + ": public cache requires explicit cacheKey");
    } else {
      if (route.ttlSeconds !== 0) fail.push(label + ": private-no-store must have ttlSeconds=0");
      if (route.cacheKey.length !== 0) fail.push(label + ": private-no-store must not define shared cache keys");
      if (route.seo !== "noindex") fail.push(label + ": private route must be noindex");
    }
    if (route.access !== "public" && route.seo !== "noindex") fail.push(label + ": authenticated/privileged route must be noindex");
    if (route.locale === "path" && !route.pattern.includes("{locale}")) fail.push(label + ": locale=path requires {locale} in route pattern");
    if (route.id === "search" && route.seo !== "noindex") fail.push("Search route must be noindex.");
    if (route.id === "app-reviews" && route.seo !== "conditional") fail.push("Review route must use conditional indexing.");
  }
  for (const id of ["home","app-detail","app-reviews","search","account","library","developer-console","admin-console"]) {
    if (!ids.has(id)) fail.push("Required route missing: " + id);
  }
}

// Enforce route-policy manifest updates whenever Next.js route implementation changes.
// BASE_REF is supplied by GitHub Actions. Local runs without it still perform static checks.
const baseRef = process.env.BASE_REF;
if (baseRef && baseRef !== "0000000000000000000000000000000000000000") {
  try {
    const range = process.env.EVENT_NAME === "pull_request"
      ? `${baseRef}...HEAD`
      : `${baseRef}..HEAD`;
    const changed = execFileSync("git", ["diff", "--name-only", range], { encoding: "utf8" })
      .split("\n").map((p) => p.trim()).filter(Boolean);
    const routeFiles = changed.filter((p) =>
      /^apps\/(?:play-web|developer-web)\/(?:src\/)?(?:app|pages)\/.+\.(?:tsx?|jsx?)$/.test(p)
    );
    if (routeFiles.length > 0 && !changed.includes("docs/PLAY_ROUTE_POLICY_MANIFEST.json")) {
      fail.push(
        "Globe Play route implementation changed without updating docs/PLAY_ROUTE_POLICY_MANIFEST.json: " +
        routeFiles.join(", ")
      );
    }
  } catch (error) {
    fail.push("Unable to inspect changed files for route-policy enforcement: " + error.message);
  }
}

if (fail.length) {
  console.error("Marketplace contract validation FAILED:");
  for (const item of fail) console.error(" - " + item);
  process.exit(1);
}

console.log("Marketplace contract validation PASSED.");
console.log(" - Master contract and AGENTS mandatory rules present.");
console.log(" - " + manifest.routes.length + " route policies validated.");
const webAppExists = existsSync(resolve(root, "apps/play-web"));
const developerAppExists = existsSync(resolve(root, "apps/developer-web"));
console.log(webAppExists
  ? " - Marketplace web app detected: runtime cache/SEO/E2E checks must be enabled in its CI."
  : " - Marketplace web app not present yet: runtime CDN/SEO/Neon checks are pending and are NOT claimed as verified.");
console.log(developerAppExists
  ? " - Developer portal detected: private no-store, authentication and tenant-isolation E2E checks are required before activation."
  : " - Developer portal not present yet: private console E2E checks remain pending.");
