export const TABS = {
  services: "Services",
  settings: "Settings",
  bookings: "Bookings",
};

export const SERVICE_COLUMNS = [
  "service_id",
  "name",
  "price_usd",
  "duration_minutes",
  "active",
];

export const SETTING_COLUMNS = ["key", "value"];

// date, start_time, and end_time are salon-local wall times.
// created_at and the *_at mail fields are ISO instants with an offset.
export const BOOKING_COLUMNS = [
  "booking_id",
  "created_at",
  "service_id",
  "date",
  "start_time",
  "end_time",
  "customer_name",
  "customer_email",
  "customer_phone",
  "status",
  "email_opt_out",
  "owner_notified_at",
  "reminder_sent_at",
  "review_sent_at",
];

export const REQUIRED_SETTING_KEYS = [
  "business_name",
  "timezone",
  "address",
  "phone",
  "salon_email",
  "currency",
  "open_time",
  "close_time",
  "open_days",
  "slot_minutes",
  "min_lead_minutes",
  "booking_window_days",
  "reminder_time",
  "review_time",
];

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME_KEYS = ["open_time", "close_time", "reminder_time", "review_time"];
const INTEGER_KEYS = ["slot_minutes", "min_lead_minutes", "booking_window_days"];
const MAIL_TIME_FIELDS = ["owner_notified_at", "reminder_sent_at", "review_sent_at"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export const seedServices = [
  ["womens-cut", "Women's haircut & blow-dry", "75", "60", "yes"],
  ["mens-cut", "Men's haircut", "40", "30", "yes"],
  ["blow-dry", "Blow-dry & style", "45", "45", "yes"],
  ["root-color", "Root color", "95", "90", "yes"],
  ["keratin", "Keratin treatment", "250", "120", "yes"],
].map(toService);

export const seedSettings = [
  ["business_name", "Willow & Comb Hair Studio"],
  ["timezone", "America/Chicago"],
  ["address", "100 Demo Lane, Austin, TX 78701"],
  ["phone", "+1 512 555 0148"],
  ["salon_email", "salon@willowandcomb.example"],
  ["currency", "USD"],
  ["open_time", "10:00"],
  ["close_time", "19:00"],
  ["open_days", "tue,wed,thu,fri,sat,sun"],
  ["slot_minutes", "30"],
  ["min_lead_minutes", "120"],
  ["booking_window_days", "14"],
  ["reminder_time", "08:00"],
  ["review_time", "19:30"],
].map(([key, value]) => ({ key, value }));

export const seedBooking = {
  booking_id: "b-1001",
  created_at: "2026-10-26T14:00:00-05:00",
  service_id: "womens-cut",
  date: "2026-10-28",
  start_time: "10:00",
  end_time: "11:00",
  customer_name: "Avery Quinn",
  customer_email: "avery.quinn@example.com",
  customer_phone: "+1 512 555 0199",
  status: "confirmed",
  email_opt_out: "",
  owner_notified_at: "",
  reminder_sent_at: "",
  review_sent_at: "",
};

export function validateServices(rows) {
  const errors = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    errors.push(...missingColumns(row, SERVICE_COLUMNS).map((error) => `row ${index + 1}: ${error}`));
    if (!SLUG_RE.test(String(row.service_id ?? ""))) {
      errors.push(`row ${index + 1}: service_id is invalid`);
    }
    if (seen.has(row.service_id)) errors.push(`duplicate service_id ${row.service_id}`);
    seen.add(row.service_id);
    if (String(row.name ?? "").trim() === "") errors.push(`row ${index + 1}: name is empty`);
    if (!isMoney(row.price_usd)) errors.push(`row ${index + 1}: price_usd is invalid`);
    if (!isPositiveInteger(row.duration_minutes)) {
      errors.push(`row ${index + 1}: duration_minutes must be a positive integer`);
    }
    if (row.active !== "yes" && row.active !== "no") {
      errors.push(`row ${index + 1}: active must be yes or no`);
    }
  });
  return errors;
}

export function validateSettings(rows) {
  const errors = [];
  const values = new Map();
  rows.forEach((row, index) => {
    errors.push(...missingColumns(row, SETTING_COLUMNS).map((error) => `row ${index + 1}: ${error}`));
    if (values.has(row.key)) errors.push(`duplicate setting ${row.key}`);
    values.set(row.key, row.value);
  });
  for (const key of REQUIRED_SETTING_KEYS) {
    if (!values.has(key) || String(values.get(key) ?? "").trim() === "") {
      errors.push(`missing setting ${key}`);
    }
  }
  if (values.has("salon_email") && !EMAIL_RE.test(String(values.get("salon_email")))) {
    errors.push("salon_email is not an email");
  }
  for (const key of TIME_KEYS) {
    if (values.has(key) && !TIME_RE.test(String(values.get(key)))) errors.push(`${key} is invalid`);
  }
  for (const key of INTEGER_KEYS) {
    if (values.has(key) && !isPositiveInteger(values.get(key))) {
      errors.push(`${key} must be a positive integer`);
    }
  }
  if (TIME_RE.test(String(values.get("open_time"))) && TIME_RE.test(String(values.get("close_time")))) {
    if (minutesOfDay(values.get("close_time")) <= minutesOfDay(values.get("open_time"))) {
      errors.push("close_time must be after open_time");
    }
  }
  if (values.has("open_days")) errors.push(...validateOpenDays(values.get("open_days")));
  return errors;
}

export function validateBooking(row) {
  const errors = [...missingColumns(row, BOOKING_COLUMNS)];
  if (!SLUG_RE.test(String(row.booking_id ?? ""))) errors.push("booking_id is invalid");
  if (!isIsoInstant(row.created_at)) errors.push("created_at is invalid");
  if (!SLUG_RE.test(String(row.service_id ?? ""))) errors.push("service_id is invalid");
  if (!isDate(row.date)) errors.push("date is invalid");
  if (!TIME_RE.test(String(row.start_time ?? ""))) errors.push("start_time is invalid");
  if (!TIME_RE.test(String(row.end_time ?? ""))) errors.push("end_time is invalid");
  if (String(row.customer_name ?? "").trim() === "") errors.push("customer_name is empty");
  if (String(row.customer_email ?? "").trim() === "") errors.push("customer_email is empty");
  else if (!EMAIL_RE.test(String(row.customer_email))) errors.push("customer_email is not an email");
  if (row.customer_phone !== "" && !hasEnoughDigits(row.customer_phone)) {
    errors.push("customer_phone is invalid");
  }
  if (row.status !== "confirmed" && row.status !== "cancelled") {
    errors.push("status must be confirmed or cancelled");
  }
  if (row.email_opt_out !== "" && row.email_opt_out !== "yes") {
    errors.push("email_opt_out must be yes or empty");
  }
  for (const field of MAIL_TIME_FIELDS) {
    if (row[field] !== "" && !isIsoInstant(row[field])) errors.push(`${field} is invalid`);
  }
  return errors;
}

function toService([service_id, name, price_usd, duration_minutes, active]) {
  return { service_id, name, price_usd, duration_minutes, active };
}

function missingColumns(row, columns) {
  return columns.filter((column) => !hasOwn(row, column)).map((column) => `missing column ${column}`);
}

function hasOwn(row, column) {
  return Object.prototype.hasOwnProperty.call(row, column);
}

function validateOpenDays(value) {
  const days = String(value).split(",").map((day) => day.trim()).filter(Boolean);
  const errors = [];
  if (days.length === 0) errors.push("open_days is empty");
  const seen = new Set();
  for (const day of days) {
    if (!WEEKDAYS.includes(day)) errors.push(`open_days has an unknown day ${day}`);
    if (seen.has(day)) errors.push(`open_days has a duplicate ${day}`);
    seen.add(day);
  }
  return errors;
}

function isMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && Math.round(amount * 100) === amount * 100;
}

function isPositiveInteger(value) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0;
}

function isDate(value) {
  if (!DATE_RE.test(String(value))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isIsoInstant(value) {
  return ISO_RE.test(String(value)) && Number.isFinite(Date.parse(value));
}

function hasEnoughDigits(value) {
  return (String(value).match(/\d/g) ?? []).length >= 7;
}

function minutesOfDay(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}
