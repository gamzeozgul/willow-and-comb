import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { salonTimestamp } from "../src/bookingRules.js";
import { seedBooking, seedServices, seedSettings } from "../src/sheetContract.js";

const workflow = JSON.parse(fs.readFileSync(new URL("../n8n/notify-salon.json", import.meta.url), "utf8"));
const code = workflow.nodes.find((node) => node.name === "Choose unsent bookings").parameters.jsCode;

function prepare(bookings) {
  const $ = (name) => ({
    all: () => (name === "Read settings" ? seedSettings : seedServices).map((json) => ({ json })),
  });
  const $input = { all: () => bookings.map((json) => ({ json })) };
  return new Function("$", "$input", code)($, $input).map((item) => item.json);
}

function book(overrides) {
  return { ...seedBooking, owner_notified_at: "", ...overrides };
}

describe("the salon notification workflow", () => {
  it("polls the sheet every 5 minutes and does not open a public webhook", () => {
    const trigger = workflow.nodes.find((node) => node.name === "Every 5 minutes");
    assert.equal(trigger.parameters.rule.interval[0].minutesInterval, 5);
    assert.equal(workflow.nodes.some((node) => String(node.type).includes("webhook")), false);
    assert.equal(workflow.active, false);
    assert.match(workflow.versionId, /^[0-9a-f-]{36}$/);
    const mail = workflow.nodes.find((node) => node.name === "Email the salon");
    assert.equal(mail.parameters.options.appendAttribution, false);
    const mark = workflow.nodes.find((node) => node.name === "Mark as told");
    assert.equal(mark.parameters.options.cellFormat, "RAW");
    assert.equal(mark.parameters.sheetName.value, "Bookings");
  });

  it("writes one salon mail for each unsent confirmed booking, including an opt-out", () => {
    const [fresh, stopped] = prepare([
      book({ booking_id: "b-fresh" }),
      book({ booking_id: "b-stop", email_opt_out: "yes", customer_phone: "" }),
      book({ booking_id: "b-sent", owner_notified_at: "2026-10-26T15:00:00-05:00" }),
      book({ booking_id: "b-cancelled", status: "cancelled" }),
    ]);
    assert.equal(fresh.to, "salon@willowandcomb.example");
    assert.equal(fresh.subject, "New booking: Avery Quinn, 2026-10-28 10:00");
    assert.match(fresh.text, /New appointment at Willow & Comb Hair Studio/);
    assert.match(fresh.text, /Women's haircut & blow-dry/);
    assert.match(fresh.text, /Wednesday, October 28, 2026, 10:00–11:00/);
    assert.match(fresh.text, /\+1 512 555 0199/);
    assert.equal(fresh.text.includes("STOP"), false);
    assert.equal(fresh.text.includes("reply to this email"), false);
    assert.equal(stopped.text.includes("No phone number"), true);
    assert.match(fresh.owner_notified_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    const expected = Date.parse(salonTimestamp(new Date(), "America/Chicago"));
    assert.ok(Math.abs(Date.parse(fresh.owner_notified_at) - expected) < 5000);
  });
});
