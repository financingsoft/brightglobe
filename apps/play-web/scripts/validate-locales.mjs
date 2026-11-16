import { readFileSync } from "node:fs";

const en = JSON.parse(readFileSync(new URL("../src/messages/en.json", import.meta.url), "utf8"));
const zh = JSON.parse(readFileSync(new URL("../src/messages/zh-CN.json", import.meta.url), "utf8"));

function flatten(value, prefix = "", result = new Set()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? prefix + "." + key : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, path, result);
    else result.add(path);
  }
  return result;
}

const enKeys = flatten(en);
const zhKeys = flatten(zh);
const missingInChinese = [...enKeys].filter((key) => !zhKeys.has(key));
const missingInEnglish = [...zhKeys].filter((key) => !enKeys.has(key));

if (missingInChinese.length || missingInEnglish.length) {
  console.error("Locale message catalogs do not have matching keys.");
  if (missingInChinese.length) console.error("Missing in zh-CN:", missingInChinese.join(", "));
  if (missingInEnglish.length) console.error("Missing in en:", missingInEnglish.join(", "));
  process.exit(1);
}

console.log("Locale catalogs are structurally complete: " + enKeys.size + " message keys.");
