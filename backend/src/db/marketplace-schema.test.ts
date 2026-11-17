import assert from "node:assert/strict";
import test from "node:test";
import { marketplaceSchema } from "./marketplace-schema.js";

const expectedTables = [
  "developers",
  "developerMemberships",
  "developerInvitations",
  "categories",
  "categoryLocalizations",
  "apps",
  "appListingRevisions",
  "appListingRevisionCategories",
  "appListingRevisionMedia",
  "appListingPlatformTargets",
  "appVersions",
  "appArtifacts",
  "distributionSources",
  "reviews",
  "reviewRevisions",
  "reviewVotes",
  "appRatingAggregates",
  "moderationCases",
  "auditEvents",
  "domainOutbox",
  "projectionEventReceipts",
  "projectionAggregateWatermarks"
];

test("marketplace Drizzle schema exports the complete V1 source table set", () => {
  assert.deepEqual(Object.keys(marketplaceSchema).sort(), [...expectedTables].sort());
  for (const [name, table] of Object.entries(marketplaceSchema)) {
    assert.ok(table && typeof table === "object", `missing Drizzle table: ${name}`);
  }
});
