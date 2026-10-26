import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["src/sheetContract.js", "src/bookingRules.js", "src/bookingService.js"];

export function renderRules() {
  const body = sources.map((file) => stripModuleSyntax(readFileSync(join(root, file), "utf8"))).join("\n");
  return `// Generated from src. Do not edit.\n\n${body}`;
}

function stripModuleSyntax(source) {
  return source
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "")
    // Apps Script shares top-level var and function across files, not const.
    .replace(/^const /gm, "var ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

if (process.argv[1] && process.argv[1].endsWith("buildAppsScript.js")) {
  writeFileSync(join(root, "apps-script/Rules.gs"), `${renderRules()}\n`);
}
