import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOOKING_COLUMNS,
  REQUIRED_SETTING_KEYS,
  SERVICE_COLUMNS,
  SETTING_COLUMNS,
  seedBooking,
  seedServices,
  seedSettings,
  validateBooking,
  validateServices,
  validateSettings,
} from "../src/sheetContract.js";

const catalog = [
  ["womens-cut", "Women's haircut & blow-dry", "75", "60"],
  ["mens-cut", "Men's haircut", "40", "30"],
  ["blow-dry", "Blow-dry & style", "45", "45"],
  ["root-color", "Root color", "95", "90"],
  ["keratin", "Keratin treatment", "250", "120"],
];

describe("sheet contract", () => {
  it("keeps column names unique and in sheet order", () => {
    for (const columns of [SERVICE_COLUMNS, SETTING_COLUMNS, BOOKING_COLUMNS]) {
      assert.equal(new Set(columns).size, columns.length);
    }
    assert.deepEqual(SERVICE_COLUMNS, [
      "service_id",
      "name",
      "price_usd",
      "duration_minutes",
      "active",
    ]);
  });

  it("seeds the five salon services from the scope", () => {
    assert.equal(seedServices.length, catalog.length);
    catalog.forEach(([service_id, name, price_usd, duration_minutes], index) => {
      assert.equal(seedServices[index].service_id, service_id);
      assert.equal(seedServices[index].name, name);
      assert.equal(seedServices[index].price_usd, price_usd);
      assert.equal(seedServices[index].duration_minutes, duration_minutes);
      assert.equal(seedServices[index].active, "yes");
    });
    assert.deepEqual(validateServices(seedServices), []);
  });

  it("seeds the approved salon rules as sheet values", () => {
    const settings = Object.fromEntries(seedSettings.map((row) => [row.key, row.value]));
    assert.deepEqual(Object.keys(settings).sort(), [...REQUIRED_SETTING_KEYS].sort());
    assert.equal(settings.business_name, "Willow & Comb Hair Studio");
    assert.equal(settings.timezone, "America/Chicago");
    assert.equal(settings.currency, "USD");
    assert.equal(settings.open_time, "10:00");
    assert.equal(settings.close_time, "19:00");
    assert.equal(settings.open_days, "tue,wed,thu,fri,sat,sun");
    assert.equal(settings.slot_minutes, "30");
    assert.equal(settings.min_lead_minutes, "120");
    assert.equal(settings.booking_window_days, "14");
    assert.deepEqual(validateSettings(seedSettings), []);
  });

  it("accepts a complete fictional booking", () => {
    assert.deepEqual(Object.keys(seedBooking), BOOKING_COLUMNS);
    assert.equal(seedBooking.service_id, "womens-cut");
    assert.deepEqual(validateBooking(seedBooking), []);
    assert.deepEqual(validateBooking({ ...seedBooking, status: "cancelled", customer_phone: "" }), []);
  });
});

describe("sheet rows that must be rejected", () => {
  it("rejects a broken service row", () => {
    const mensCut = { ...seedServices[1] };
    const errors = validateServices([
      { ...seedServices[0], service_id: "Womens Cut", price_usd: "0", active: "maybe" },
      mensCut,
      { ...mensCut },
    ]);
    assert.ok(errors.includes("row 1: service_id is invalid"));
    assert.ok(errors.includes("row 1: price_usd is invalid"));
    assert.ok(errors.includes("row 1: active must be yes or no"));
    assert.ok(errors.includes("duplicate service_id mens-cut"));
  });

  it("rejects settings that cannot drive the calendar", () => {
    const rows = seedSettings.map((row) => ({ ...row }));
    replace(rows, "timezone", "");
    replace(rows, "close_time", "09:00");
    replace(rows, "open_days", "tue,monday,tue");
    replace(rows, "slot_minutes", "30.5");
    const errors = validateSettings(rows);
    assert.ok(errors.includes("missing setting timezone"));
    assert.ok(errors.includes("close_time must be after open_time"));
    assert.ok(errors.includes("open_days has an unknown day monday"));
    assert.ok(errors.includes("open_days has a duplicate tue"));
    assert.ok(errors.includes("slot_minutes must be a positive integer"));
  });

  it("rejects a booking with a bad date, status, or email", () => {
    const errors = validateBooking({
      ...seedBooking,
      date: "2026-02-31",
      status: "pending",
      customer_email: "",
      email_opt_out: "no",
      reminder_sent_at: "tomorrow",
    });
    assert.ok(errors.includes("date is invalid"));
    assert.ok(errors.includes("status must be confirmed or cancelled"));
    assert.ok(errors.includes("customer_email is empty"));
    assert.ok(errors.includes("email_opt_out must be yes or empty"));
    assert.ok(errors.includes("reminder_sent_at is invalid"));
  });
});

function replace(rows, key, value) {
  const row = rows.find((item) => item.key === key);
  row.value = value;
}
