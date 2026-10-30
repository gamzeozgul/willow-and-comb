import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSettings } from "../src/bookingRules.js";
import { bookAppointment, describeSettings, publicCatalog } from "../src/bookingService.js";
import { seedServices, seedSettings } from "../src/sheetContract.js";

const settings = readSettings(seedSettings);
const now = new Date("2026-10-19T15:00:00.000Z");

function memoryStore(bookings, ids = ["b-2001", "b-2002"]) {
  return {
    withLock(run) {
      return run();
    },
    readBookings() {
      return bookings.map((row) => ({ ...row }));
    },
    append(row) {
      bookings.push({ ...row });
    },
    nextId() {
      return ids.shift();
    },
  };
}

function confirmed(overrides = {}) {
  return {
    booking_id: "b-1",
    created_at: "2026-10-18T10:00:00-05:00",
    service_id: "womens-cut",
    date: "2026-10-20",
    start_time: "10:00",
    end_time: "11:00",
    customer_name: "Avery Quinn",
    customer_email: "avery.quinn@example.com",
    customer_phone: "",
    status: "confirmed",
    email_opt_out: "",
    owner_notified_at: "",
    reminder_sent_at: "",
    review_sent_at: "",
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    service_id: "womens-cut",
    date: "2026-10-20",
    start_time: "10:00",
    customer_name: "Avery Quinn",
    customer_email: "avery.quinn@example.com",
    customer_phone: "",
    ...overrides,
  };
}

describe("booking from the customer page", () => {
  it("shows active services and the studio phone from the sheet", () => {
    const hidden = { ...seedServices[4], active: "no" };
    const catalog = publicCatalog(settings, [...seedServices.slice(0, 4), hidden]);
    assert.equal(catalog.businessName, "Willow & Comb Hair Studio");
    assert.equal(catalog.phone, "+1 512 555 0148");
    assert.deepEqual(catalog.services.map((service) => service.service_id), [
      "womens-cut",
      "mens-cut",
      "blow-dry",
      "root-color",
    ]);
  });

  it("names the first broken setting instead of opening the page", () => {
    const rows = seedSettings.map((row) => ({ ...row }));
    rows.find((row) => row.key === "open_days").value = "";
    const described = describeSettings(rows);
    assert.equal(described.ok, false);
    assert.equal(described.message, "The studio settings need a fix: missing setting open_days");
    assert.equal(describeSettings(seedSettings).ok, true);
  });

  it("writes one confirmed row and refuses the same slot immediately after", () => {
    const bookings = [];
    const store = memoryStore(bookings);
    const first = bookAppointment({ settings, services: seedServices, now, request: request(), store });
    const second = bookAppointment({ settings, services: seedServices, now, request: request({ customer_name: "Blair Moss" }), store });

    assert.equal(first.ok, true);
    assert.equal(first.booking.booking_id, "b-2001");
    assert.equal(first.booking.created_at, "2026-10-19T10:00:00-05:00");
    assert.equal(first.booking.end_time, "11:00");
    assert.equal(first.booking.status, "confirmed");
    assert.equal(first.booking.owner_notified_at, "");
    assert.equal(second.ok, false);
    assert.equal(second.reason, "overlap");
    assert.equal(bookings.length, 1);
  });

  it("does not keep a row when the email is missing", () => {
    const bookings = [];
    const result = bookAppointment({
      settings,
      services: seedServices,
      now,
      request: request({ customer_email: "" }),
      store: memoryStore(bookings),
    });
    assert.equal(result.reason, "invalid");
    assert.equal(bookings.length, 0);
  });

  it("accepts a filled-in hidden field without saving a row", () => {
    const bookings = [];
    const result = bookAppointment({
      settings,
      services: seedServices,
      now,
      request: request({ leave_blank: "Acme" }),
      store: memoryStore(bookings),
    });
    assert.equal(result.ok, true);
    assert.equal(result.booking, undefined);
    assert.match(result.message, /You're booked for Women's haircut & blow-dry on 2026-10-20 at 10:00/);
    assert.equal(bookings.length, 0);
  });

  it("stops a third upcoming appointment for the same email", () => {
    const bookings = [
      confirmed({ date: "2026-10-20" }),
      confirmed({ booking_id: "b-2", date: "2026-10-21", customer_email: "Avery.Quinn@Example.com" }),
    ];
    const result = bookAppointment({
      settings,
      services: seedServices,
      now,
      request: request({ date: "2026-10-22", customer_email: "avery.quinn@example.com" }),
      store: memoryStore(bookings, ["b-2003"]),
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "too-many");
    assert.match(result.message, /\+1 512 555 0148/);
    assert.equal(bookings.length, 2);
  });

  it("lets the same email book again after earlier visits have ended", () => {
    const bookings = [
      confirmed({ date: "2026-10-18", start_time: "10:00", end_time: "11:00" }),
      confirmed({ booking_id: "b-2", date: "2026-10-18", start_time: "12:00", end_time: "13:00", status: "cancelled" }),
      confirmed({ booking_id: "b-3", date: "2026-10-21" }),
    ];
    const result = bookAppointment({
      settings,
      services: seedServices,
      now,
      request: request({ date: "2026-10-22", customer_email: "Avery.Quinn@Example.com" }),
      store: memoryStore(bookings, ["b-2004"]),
    });
    assert.equal(result.ok, true);
    assert.equal(result.booking.customer_email, "avery.quinn@example.com");
    assert.equal(bookings.length, 4);
  });

  it("ignores a status sent by the browser", () => {
    const bookings = [];
    const result = bookAppointment({
      settings,
      services: seedServices,
      now,
      request: request({ status: "cancelled", price_usd: "1" }),
      store: memoryStore(bookings),
    });
    assert.equal(result.booking.status, "confirmed");
    assert.equal(bookings[0].price_usd, undefined);
  });
});
