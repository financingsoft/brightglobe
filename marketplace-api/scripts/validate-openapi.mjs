import { readFileSync } from "node:fs";

const spec = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
const failures = [];
if (spec.openapi !== "3.1.0") failures.push("OpenAPI version must be 3.1.0.");
if (!spec.paths?.["/api/v1/play/apps/{slug}"]?.get) failures.push("Missing public app detail GET operation.");
if (!spec.paths?.["/api/v1/play/apps/{slug}/reviews"]?.get) failures.push("Missing public reviews GET operation.");
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(item)) {
    if (method.toLowerCase() !== "get") failures.push("Public read API must not expose write method " + method.toUpperCase() + " on " + path + ".");
    if (!operation.operationId) failures.push("Missing operationId for " + method.toUpperCase() + " " + path + ".");
    if (!operation.responses?.["200"] || !operation.responses?.["404"] || !operation.responses?.["503"]) failures.push("Missing required response contract for " + method.toUpperCase() + " " + path + ".");
  }
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Globe Play public API OpenAPI contract validation passed.");
