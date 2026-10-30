import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { bookingsToRemind, readSettings, salonTimestamp } from "../src/bookingRules.js";
import { seedBooking, seedServices, seedSettings } from "../src/sheetContract.js";

const workflow = JSON.parse(fs.readFileSync(new URL("../n8n/remind-tomorrow.json", import.meta.url), "utf8"));
const code = workflow.nodes.find((node) => node.name === "Choose tomorrow").parameters.jsCode;
const settings = readSettings(seedSettings);

function prepare(bookings, iso) {
  const RealDate = globalThis.Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(iso);
      else super(...args);
    }
    static now() {
      return new RealDate(iso).getTime();
    }
  }
  globalThis.Date = FixedDate;
  try {
    const $ = (name) => ({
      all: () => (name === "Read settings" ? seedSettings : seedServices).map((json) => ({ json })),
    });
    const $input = { all: () => bookings.map((json) => ({ json })) };
    return new Function("$", "$input", code)($, $input).map((item) => item.json);
  } finally {
    globalThis.Date = RealDate;
  }
}

function book(overrides) {
  return { ...seedBooking, reminder_sent_at: "", ...overrides };
}

describe("the morning reminder workflow", () => {
  it("runs at 08:00 in Chicago and does not catch up later", () => {
    const trigger = workflow.nodes.find((node) => node.name === "Every morning");
    assert.equal(trigger.parameters.rule.interval[0].field, "days");
    assert.equal(trigger.parameters.rule.interval[0].triggerAtHour, 8);
    assert.equal(trigger.parameters.rule.interval[0].triggerAtMinute, 0);
    assert.equal(workflow.settings.timezone, "America/Chicago");
    assert.equal(workflow.active, false);
    const mail = workflow.nodes.find((node) => node.name === "Email the customer");
    assert.equal(mail.parameters.options.appendAttribution, false);
    const mark = workflow.nodes.find((node) => node.name === "Mark reminder sent");
    assert.equal(mark.parameters.columns.value.reminder_sent_at.includes("reminder_sent_at"), true);
    assert.equal(mark.parameters.options.cellFormat, "RAW");
  });

  it("matches the reminder rule across the autumn clock change", () => {
    const rows = [book({ booking_id: "nov1", date: "2026-11-01" }), book({ booking_id: "nov2", date: "2026-11-02" })];
    const before = new Date("2026-11-01T01:00:00.000Z");
    const after = new Date("2026-11-01T14:00:00.000Z");
    assert.deepEqual(prepare(rows, before.toISOString()).map((mail) => mail.booking_id), bookingsToRemind({ settings, bookings: rows, now: before }).map((booking) => booking.booking_id));
    assert.deepEqual(prepare(rows, after.toISOString()).map((mail) => mail.booking_id), bookingsToRemind({ settings, bookings: rows, now: after }).map((booking) => booking.booking_id));
  });

  it("writes the customer mail with the cancel line and the STOP line", () => {
    const now = new Date("2026-10-27T13:00:00.000Z");
    const rows = [
      book({ booking_id: "due", date: "2026-10-28" }),
      book({ booking_id: "today", date: "2026-10-27" }),
      book({ booking_id: "sent", date: "2026-10-28", reminder_sent_at: "2026-10-27T13:00:00-05:00" }),
      book({ booking_id: "stop", date: "2026-10-28", email_opt_out: "yes" }),
      book({ booking_id: "cancelled", date: "2026-10-28", status: "cancelled" }),
    ];
    const [mail] = prepare(rows, now.toISOString());
    assert.deepEqual([mail.booking_id], bookingsToRemind({ settings, bookings: rows, now }).map((booking) => booking.booking_id));
    assert.equal(mail.to, "avery.quinn@example.com");
    assert.equal(mail.subject, "Reminder: tomorrow at 10:00, Willow & Comb Hair Studio");
    assert.match(mail.text, /Women's haircut & blow-dry/);
    assert.match(mail.text, /Wednesday, October 28, 2026, 10:00–11:00/);
    assert.match(mail.text, /100 Demo Lane, Austin, TX 78701/);
    assert.match(mail.text, /To cancel or reschedule, reply to this email or call us\./);
    assert.match(mail.text, /To stop these emails, reply STOP\./);
    assert.equal(mail.reminder_sent_at, salonTimestamp(now, "America/Chicago"));
  });
});
