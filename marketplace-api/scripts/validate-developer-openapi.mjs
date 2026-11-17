import { readFileSync } from "node:fs";

const spec = JSON.parse(readFileSync(new URL("../developer-openapi.json", import.meta.url), "utf8"));
const failures = [];
const expected = [
  ["/api/v1/play/developers", "post", "201"],
  ["/api/v1/play/developers/{developerId}/invitations", "post", "201"],
  ["/api/v1/play/developers/{developerId}/owner-transfer", "post", "201"],
  ["/api/v1/play/invitations/accept", "post", "200"],
  ["/api/v1/play/developers/{developerId}/invitations/{invitationId}", "delete", "200"]
];
if (spec.openapi !== "3.1.0") failures.push("Private developer OpenAPI version must be 3.1.0.");
for (const [path, method, successStatus] of expected) {
  const operation = spec.paths?.[path]?.[method];
  if (!operation) {
    failures.push("Missing private developer operation " + method.toUpperCase() + " " + path + ".");
    continue;
  }
  if (!operation.operationId) failures.push("Missing operationId for " + method.toUpperCase() + " " + path + ".");
  if (!operation.responses?.[successStatus]) failures.push("Missing success response " + successStatus + " for " + method.toUpperCase() + " " + path + ".");
  if (!operation.responses?.["401"] && path !== "/api/v1/play/invitations/accept") failures.push("Missing 401 response for " + method.toUpperCase() + " " + path + ".");
  const response = operation.responses?.[successStatus];
  const cacheHeader = response?.headers?.["Cache-Control"]?.schema?.example ?? "";
  if (!String(cacheHeader).includes("private, no-store")) failures.push("Success response must document private no-store for " + method.toUpperCase() + " " + path + ".");
  if (operation.description?.toLowerCase().includes("cacheable")) failures.push("Private developer operation must not describe a cacheable response: " + path + ".");
}
if (failures.length) {
  console.error("Private developer OpenAPI validation FAILED:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Globe Play private developer OpenAPI contract validation passed.");
