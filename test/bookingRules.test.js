import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bookingsToNotifyOwner,
  bookingsToRemind,
  bookingsToReview,
  canBook,
  openSlots,
  readSettings,
} from "../src/bookingRules.js";
import { seedBooking, seedServices, seedSettings } from "../src/sheetContract.js";

const settings = readSettings(seedSettings);
const service = Object.fromEntries(seedServices.map((row) => [row.service_id, row]));
const quietMonday = new Date("2026-10-19T15:00:00.000Z");

function book(overrides) {
  return {
    ...seedBooking,
    status: "confirmed",
    email_opt_out: "",
    owner_notified_at: "",
    reminder_sent_at: "",
    review_sent_at: "",
    ...overrides,
  };
}

function starts(serviceId, date = "2026-10-20") {
  return openSlots({ settings, service: service[serviceId], bookings: [], now: quietMonday })
    .filter((slot) => slot.date === date)
    .map((slot) => slot.start_time);
}

describe("open slots follow the sheet", () => {
  it("closes Monday from the sheet and still opens Monday when the sheet says so", () => {
    assert.equal(canBook({ settings, service: service["mens-cut"], now: quietMonday, date: "2026-10-26", start_time: "12:00" }).reason, "closed");
    const mondayOpen = { ...settings, openDays: [...settings.openDays, "mon"] };
    assert.equal(canBook({ settings: mondayOpen, service: service["mens-cut"], now: quietMonday, date: "2026-10-26", start_time: "10:00" }).ok, true);
  });

  it("fits each service before close on a 30-minute grid", () => {
    assert.deepEqual(starts("keratin").at(0), "10:00");
    assert.deepEqual(starts("keratin").at(-1), "17:00");
    assert.deepEqual(starts("root-color").at(-1), "17:30");
    assert.deepEqual(starts("womens-cut").at(-1), "18:00");
    assert.deepEqual(starts("blow-dry").at(-1), "18:00");
    assert.deepEqual(starts("mens-cut").at(-1), "18:30");
    assert.equal(starts("mens-cut").includes("10:30"), true);
    assert.equal(starts("keratin").includes("17:30"), false);
  });

  it("uses the slot length from the sheet", () => {
    const hourly = { ...settings, slotMinutes: 60 };
    const slots = openSlots({ settings: hourly, service: service["mens-cut"], now: quietMonday })
      .filter((slot) => slot.date === "2026-10-20")
      .map((slot) => slot.start_time);
    assert.deepEqual(slots.slice(0, 3), ["10:00", "11:00", "12:00"]);
    assert.equal(slots.at(-1), "18:00");
  });

  it("requires two real hours and no more than 14 days", () => {
    const tuesdayMorning = new Date("2026-10-27T15:00:00.000Z");
    assert.equal(canBook({ settings, service: service["mens-cut"], now: tuesdayMorning, date: "2026-10-27", start_time: "12:00" }).ok, true);
    assert.equal(canBook({ settings, service: service["mens-cut"], now: new Date("2026-10-27T15:00:01.000Z"), date: "2026-10-27", start_time: "12:00" }).reason, "too-soon");
    assert.equal(canBook({ settings, service: service["mens-cut"], now: tuesdayMorning, date: "2026-11-10", start_time: "10:00" }).ok, true);
    assert.equal(canBook({ settings, service: service["mens-cut"], now: tuesdayMorning, date: "2026-11-11", start_time: "10:00" }).reason, "too-far");
    assert.equal(canBook({ settings, service: service["mens-cut"], now: tuesdayMorning, date: "2026-10-26", start_time: "12:00" }).reason, "past");
  });

  it("keeps the two-hour gap correct in winter as well as summer", () => {
    const winterTenAm = new Date("2026-12-02T16:00:00.000Z");
    const winter = openSlots({ settings, service: service["mens-cut"], now: winterTenAm })
      .filter((slot) => slot.date === "2026-12-02")
      .map((slot) => slot.start_time);
    assert.equal(winter[0], "12:00");
    assert.equal(canBook({ settings, service: service["mens-cut"], now: winterTenAm, date: "2026-12-02", start_time: "11:30" }).reason, "too-soon");
  });

  it("lets a cancelled booking go and keeps a confirmed one", () => {
    const taken = book({ date: "2026-10-20", start_time: "10:00", end_time: "11:00", service_id: "womens-cut" });
    const args = { settings, service: service["mens-cut"], now: quietMonday, date: "2026-10-20" };
    assert.equal(canBook({ ...args, bookings: [taken], start_time: "10:00" }).reason, "overlap");
    assert.equal(canBook({ ...args, bookings: [taken], start_time: "10:30" }).reason, "overlap");
    assert.equal(canBook({ ...args, bookings: [taken], start_time: "11:00" }).ok, true);
    assert.equal(canBook({ ...args, bookings: [{ ...taken, status: "cancelled" }], start_time: "10:00" }).ok, true);
    assert.equal(canBook({ ...args, bookings: [{ ...taken, email_opt_out: "yes" }], start_time: "10:00" }).reason, "overlap");
  });

  it("offers nothing for an inactive service", () => {
    const hidden = { ...service.keratin, active: "no" };
    assert.deepEqual(openSlots({ settings, service: hidden, now: quietMonday }), []);
    assert.equal(canBook({ settings, service: null, now: quietMonday, date: "2026-10-20", start_time: "10:00" }).reason, "unknown-service");
  });
});

describe("which bookings get an email", () => {
  it("tells the salon about unsent confirmed bookings only", () => {
    const fresh = book({ booking_id: "b-fresh" });
    const optedOut = book({ booking_id: "b-stop", email_opt_out: "yes" });
    const sent = book({ booking_id: "b-sent", owner_notified_at: "2026-10-26T15:00:00-05:00" });
    const cancelled = book({ booking_id: "b-cancelled", status: "cancelled" });
    assert.deepEqual(
      bookingsToNotifyOwner([sent, cancelled, fresh, optedOut]).map((booking) => booking.booking_id),
      ["b-fresh", "b-stop"],
    );
  });

  it("reminds tomorrow in Chicago time, including across the autumn clock change", () => {
    const rows = [book({ booking_id: "nov1", date: "2026-11-01" }), book({ booking_id: "nov2", date: "2026-11-02" })];
    const lateOctober = bookingsToRemind({ settings, bookings: rows, now: new Date("2026-11-01T01:00:00.000Z") });
    assert.deepEqual(lateOctober.map((booking) => booking.booking_id), ["nov1"]);
    const reminderHour = bookingsToRemind({ settings, bookings: rows, now: new Date("2026-11-01T14:00:00.000Z") });
    assert.deepEqual(reminderHour.map((booking) => booking.booking_id), ["nov2"]);
  });

  it("skips reminder mail that was sent, cancelled, or opted out", () => {
    const now = new Date("2026-10-27T13:00:00.000Z");
    const rows = [
      book({ booking_id: "due", date: "2026-10-28" }),
      book({ booking_id: "today", date: "2026-10-27" }),
      book({ booking_id: "sent", date: "2026-10-28", reminder_sent_at: "2026-10-27T13:00:00-05:00" }),
      book({ booking_id: "stop", date: "2026-10-28", email_opt_out: "yes" }),
      book({ booking_id: "cancelled", date: "2026-10-28", status: "cancelled" }),
    ];
    assert.deepEqual(bookingsToRemind({ settings, bookings: rows, now }).map((booking) => booking.booking_id), ["due"]);
  });

  it("asks for a review only after today's appointment has ended in Chicago", () => {
    const reviewHour = new Date("2026-10-28T00:30:00.000Z");
    const utcAfternoon = new Date("2026-10-27T19:30:00.000Z");
    const rows = [
      book({ booking_id: "morning", date: "2026-10-27", start_time: "10:00", end_time: "11:00" }),
      book({ booking_id: "evening", date: "2026-10-27", start_time: "17:00", end_time: "18:00" }),
      book({ booking_id: "tomorrow", date: "2026-10-28", start_time: "10:00", end_time: "11:00" }),
      book({ booking_id: "yesterday", date: "2026-10-26", start_time: "10:00", end_time: "11:00" }),
      book({ booking_id: "sent", date: "2026-10-27", start_time: "12:00", end_time: "13:00", review_sent_at: "2026-10-27T19:30:00-05:00" }),
      book({ booking_id: "stop", date: "2026-10-27", start_time: "13:00", end_time: "14:00", email_opt_out: "yes" }),
      book({ booking_id: "cancelled", date: "2026-10-27", start_time: "14:00", end_time: "15:00", status: "cancelled" }),
    ];
    assert.deepEqual(bookingsToReview({ settings, bookings: rows, now: reviewHour }).map((booking) => booking.booking_id), ["morning", "evening"]);
    assert.deepEqual(bookingsToReview({ settings, bookings: rows, now: utcAfternoon }).map((booking) => booking.booking_id), ["morning"]);
  });
});
