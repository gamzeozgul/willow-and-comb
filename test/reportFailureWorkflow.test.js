import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

function readWorkflow(name) {
  return JSON.parse(fs.readFileSync(new URL(`../n8n/${name}.json`, import.meta.url), "utf8"));
}

const report = readWorkflow("report-a-failure");
const breaker = readWorkflow("break-on-purpose");
const callers = ["notify-salon", "remind-tomorrow", "ask-for-a-review", "break-on-purpose"].map(readWorkflow);

describe("the failure mail", () => {
  it("tells the owner and does not look like a customer email", () => {
    const trigger = report.nodes.find((node) => node.type === "n8n-nodes-base.errorTrigger");
    const mail = report.nodes.find((node) => node.name === "Email the owner");
    assert.ok(trigger);
    assert.equal(mail.parameters.sendTo, "PASTE_OWNER_EMAIL");
    assert.equal(mail.parameters.subject, "=Workflow failed: {{ $json.workflow.name }}");
    assert.match(mail.parameters.message, /A Willow & Comb workflow failed\./);
    assert.match(mail.parameters.message, /\{\{ \$json\.execution\.error\.message/);
    assert.equal(mail.parameters.options.appendAttribution, false);
    assert.equal(mail.parameters.message.includes("STOP"), false);
    assert.equal(report.active, false);
    assert.equal(report.settings.callerPolicy, "workflowsFromSameOwner");
    assert.equal(report.settings.errorWorkflow, undefined);
  });

  it("is the error workflow for every salon workflow", () => {
    const ids = callers.map((workflow) => workflow.settings.errorWorkflow);
    assert.equal(new Set(ids).size, 1);
    assert.match(ids[0], /^[A-Za-z0-9]{16}$/);
    assert.match(breaker.nodes.find((node) => node.name === "Fail").parameters.jsCode, /This failure is a test/);
    assert.equal(breaker.active, false);
  });
});
