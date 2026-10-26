import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSettings } from "../src/bookingRules.js";
import { bookAppointment, publicCatalog } from "../src/bookingService.js";
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
