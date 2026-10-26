import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { renderRules } from "../scripts/buildAppsScript.js";

describe("Apps Script bundle", () => {
  it("matches the current booking rules", () => {
    const committed = readFileSync(new URL("../apps-script/Rules.gs", import.meta.url), "utf8");
    assert.equal(committed.replace(/\r\n/g, "\n"), `${renderRules()}\n`.replace(/\r\n/g, "\n"));
  });

  it("parses as one script file", () => {
    const dir = mkdtempSync(join(tmpdir(), "willow-rules-"));
    const file = join(dir, "Rules.js");
    writeFileSync(file, renderRules());
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    assert.equal(result.status, 0, result.stderr);
  });
});
