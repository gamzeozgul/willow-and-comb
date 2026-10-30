import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { bookingsToReview, readSettings, salonTimestamp } from "../src/bookingRules.js";
import { seedBooking, seedServices, seedSettings } from "../src/sheetContract.js";

const workflow = JSON.parse(fs.readFileSync(new URL("../n8n/ask-for-a-review.json", import.meta.url), "utf8"));
const code = workflow.nodes.find((node) => node.name === "Choose finished visits").parameters.jsCode;
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
  return { ...seedBooking, review_sent_at: "", ...overrides };
}

const rows = [
  book({ booking_id: "morning", date: "2026-10-27", start_time: "10:00", end_time: "11:00" }),
  book({ booking_id: "evening", date: "2026-10-27", start_time: "17:00", end_time: "18:00" }),
  book({ booking_id: "tomorrow", date: "2026-10-28", start_time: "10:00", end_time: "11:00" }),
  book({ booking_id: "yesterday", date: "2026-10-26", start_time: "10:00", end_time: "11:00" }),
  book({ booking_id: "sent", date: "2026-10-27", start_time: "12:00", end_time: "13:00", review_sent_at: "2026-10-27T19:30:00-05:00" }),
  book({ booking_id: "stop", date: "2026-10-27", start_time: "13:00", end_time: "14:00", email_opt_out: "yes" }),
  book({ booking_id: "cancelled", date: "2026-10-27", start_time: "14:00", end_time: "15:00", status: "cancelled" }),
];

describe("the evening review workflow", () => {
  it("runs at 19:30 in Chicago and does not catch up later", () => {
    const trigger = workflow.nodes.find((node) => node.name === "Every evening");
    assert.equal(trigger.parameters.rule.interval[0].field, "days");
    assert.equal(trigger.parameters.rule.interval[0].triggerAtHour, 19);
    assert.equal(trigger.parameters.rule.interval[0].triggerAtMinute, 30);
    assert.equal(workflow.settings.timezone, "America/Chicago");
    assert.equal(workflow.active, false);
    const mail = workflow.nodes.find((node) => node.name === "Email the customer");
    assert.equal(mail.parameters.options.appendAttribution, false);
    const mark = workflow.nodes.find((node) => node.name === "Mark review sent");
    assert.equal(mark.parameters.columns.value.review_sent_at.includes("review_sent_at"), true);
    assert.equal(mark.parameters.options.cellFormat, "RAW");
  });

  it("asks only after today's appointment has ended", () => {
    const reviewHour = new Date("2026-10-28T00:30:00.000Z");
    const afternoon = new Date("2026-10-27T19:30:00.000Z");
    assert.deepEqual(
      prepare(rows, reviewHour.toISOString()).map((mail) => mail.booking_id),
      bookingsToReview({ settings, bookings: rows, now: reviewHour }).map((booking) => booking.booking_id),
    );
    assert.deepEqual(
      prepare(rows, afternoon.toISOString()).map((mail) => mail.booking_id),
      bookingsToReview({ settings, bookings: rows, now: afternoon }).map((booking) => booking.booking_id),
    );
  });

  it("writes the review mail with the cancel line and the STOP line", () => {
    const now = new Date("2026-10-28T00:30:00.000Z");
    const mail = prepare(rows, now.toISOString()).find((item) => item.booking_id === "morning");
    assert.equal(mail.to, "avery.quinn@example.com");
    assert.equal(mail.subject, "How was your visit to Willow & Comb Hair Studio?");
    assert.match(mail.text, /Women's haircut & blow-dry/);
    assert.match(mail.text, /Tuesday, October 27, 2026, 10:00–11:00/);
    assert.match(mail.text, /Reply to this email and tell us how it went\./);
    assert.match(mail.text, /To cancel or reschedule, reply to this email or call us\./);
    assert.match(mail.text, /To stop these emails, reply STOP\./);
    assert.equal(mail.review_sent_at, salonTimestamp(now, "America/Chicago"));
  });
});
