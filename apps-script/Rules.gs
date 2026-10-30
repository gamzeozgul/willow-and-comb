// Generated from src. Do not edit.

var SERVICE_COLUMNS = [
  "service_id",
  "name",
  "price_usd",
  "duration_minutes",
  "active",
];

var SETTING_COLUMNS = ["key", "value"];

// date, start_time, and end_time are salon-local wall times.
// created_at and the *_at mail fields are ISO instants with an offset.
var BOOKING_COLUMNS = [
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

var REQUIRED_SETTING_KEYS = [
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

var WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
var TIME_KEYS = ["open_time", "close_time", "reminder_time", "review_time"];
var INTEGER_KEYS = ["slot_minutes", "min_lead_minutes", "booking_window_days"];
var MAIL_TIME_FIELDS = ["owner_notified_at", "reminder_sent_at", "review_sent_at"];

var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

var seedServices = [
  ["womens-cut", "Women's haircut & blow-dry", "75", "60", "yes"],
  ["mens-cut", "Men's haircut", "40", "30", "yes"],
  ["blow-dry", "Blow-dry & style", "45", "45", "yes"],
  ["root-color", "Root color", "95", "90", "yes"],
  ["keratin", "Keratin treatment", "250", "120", "yes"],
].map(toService);

var seedSettings = [
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

var seedBooking = {
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

function validateServices(rows) {
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

function validateSettings(rows) {
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

function validateBooking(row) {
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
var WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function readSettings(rows) {
  const values = Object.fromEntries(rows.map((row) => [row.key, String(row.value)]));
  return {
    businessName: values.business_name,
    timeZone: values.timezone,
    address: values.address,
    phone: values.phone,
    salonEmail: values.salon_email,
    currency: values.currency,
    openTime: values.open_time,
    closeTime: values.close_time,
    openDays: values.open_days.split(",").map((day) => day.trim()).filter(Boolean),
    slotMinutes: Number(values.slot_minutes),
    minLeadMinutes: Number(values.min_lead_minutes),
    bookingWindowDays: Number(values.booking_window_days),
    reminderTime: values.reminder_time,
    reviewTime: values.review_time,
  };
}

function openSlots({ settings, service, bookings = [], now }) {
  assertNow(now);
  if (!isActive(service)) return [];
  const slots = [];
  for (const date of datesInWindow(settings, now)) {
    for (const start_time of startTimes(settings, service)) {
      const decision = canBook({ settings, service, bookings, now, date, start_time });
      if (decision.ok) slots.push({ date, start_time, end_time: decision.end_time });
    }
  }
  return slots;
}

function canBook({ settings, service, bookings = [], now, date, start_time }) {
  assertNow(now);
  if (!service) return no("unknown-service");
  if (!isActive(service)) return no("inactive");

  const today = salonDate(now, settings.timeZone);
  const lastDate = addDays(today, settings.bookingWindowDays);
  if (date < today) return no("past");
  if (date > lastDate) return no("too-far");
  if (!settings.openDays.includes(weekday(date))) return no("closed");
  if (!startTimes(settings, service).includes(start_time)) return no("outside-hours");

  const startAt = zonedWallTimeToDate(date, start_time, settings.timeZone);
  const end_time = addMinutes(start_time, Number(service.duration_minutes));
  const earliest = now.getTime() + settings.minLeadMinutes * 60 * 1000;
  if (startAt.getTime() < now.getTime()) return no("past");
  if (startAt.getTime() < earliest) return no("too-soon");
  if (overlaps(startAt, zonedWallTimeToDate(date, end_time, settings.timeZone), bookings, settings.timeZone)) {
    return no("overlap");
  }
  return { ok: true, end_time };
}

function bookingsToNotifyOwner(bookings) {
  return bookings.filter((booking) => booking.status === "confirmed" && booking.owner_notified_at === "");
}

function bookingsToRemind({ settings, bookings, now }) {
  assertNow(now);
  const tomorrow = addDays(salonDate(now, settings.timeZone), 1);
  return bookings.filter((booking) => isCustomerMailDue(booking) && booking.reminder_sent_at === "" && booking.date === tomorrow);
}

function bookingsToReview({ settings, bookings, now }) {
  assertNow(now);
  const today = salonDate(now, settings.timeZone);
  return bookings.filter((booking) => {
    if (!isCustomerMailDue(booking) || booking.review_sent_at !== "" || booking.date !== today) return false;
    const endAt = bookingInterval(booking, settings.timeZone).end;
    return endAt.getTime() <= now.getTime();
  });
}

function isCustomerMailDue(booking) {
  return booking.status === "confirmed" && booking.email_opt_out !== "yes";
}

function isActive(service) {
  return Boolean(service) && service.active === "yes";
}

function no(reason) {
  return { ok: false, reason };
}

function datesInWindow(settings, now) {
  const today = salonDate(now, settings.timeZone);
  return Array.from({ length: settings.bookingWindowDays + 1 }, (_, day) => addDays(today, day));
}

function startTimes(settings, service) {
  const open = toMinutes(settings.openTime);
  const close = toMinutes(settings.closeTime);
  const duration = Number(service.duration_minutes);
  const starts = [];
  for (let minute = open; minute + duration <= close; minute += settings.slotMinutes) {
    starts.push(formatMinutes(minute));
  }
  return starts;
}

function overlaps(startAt, endAt, bookings, timeZone) {
  return bookings.some((booking) => {
    if (booking.status !== "confirmed") return false;
    const existing = bookingInterval(booking, timeZone);
    return startAt < existing.end && existing.start < endAt;
  });
}

function bookingInterval(booking, timeZone) {
  const start = zonedWallTimeToDate(booking.date, booking.start_time, timeZone);
  const endDate = toMinutes(booking.end_time) <= toMinutes(booking.start_time) ? addDays(booking.date, 1) : booking.date;
  return { start, end: zonedWallTimeToDate(endDate, booking.end_time, timeZone) };
}

function salonTimestamp(instant, timeZone) {
  assertNow(instant);
  const parts = salonParts(instant, timeZone);
  const offsetMinutes = Math.round(offsetMs(instant, timeZone) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  const clock = [parts.hour, parts.minute, parts.second].map((part) => String(part).padStart(2, "0")).join(":");
  return `${formatDate(parts.year, parts.month, parts.day)}T${clock}${sign}${hours}:${minutes}`;
}

function salonDate(instant, timeZone) {
  const parts = salonParts(instant, timeZone);
  return formatDate(parts.year, parts.month, parts.day);
}

function salonParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour) % 24,
    minute: Number(value.minute),
    second: Number(value.second),
  };
}

function zonedWallTimeToDate(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const corrected = guess - offsetMs(new Date(guess - offsetMs(new Date(guess), timeZone)), timeZone);
  return new Date(corrected);
}

function offsetMs(instant, timeZone) {
  const parts = salonParts(instant, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant.getTime();
}

function weekday(date) {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function addMinutes(time, minutes) {
  return formatMinutes(toMinutes(time) + minutes);
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function assertNow(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("now must be a Date");
}
var MESSAGES = {
  past: "That time has already passed.",
  "too-soon": "Please book at least 2 hours ahead.",
  "too-far": "That date is too far ahead.",
  closed: "The studio is closed that day.",
  "outside-hours": "That time is not available.",
  overlap: "That time was just taken. Please pick another.",
  inactive: "That service is no longer available.",
  "unknown-service": "Please choose a service.",
  invalid: "Please check the name and email.",
};

function publicCatalog(settings, services) {
  return {
    businessName: settings.businessName,
    address: settings.address,
    phone: settings.phone,
    services: services.filter((service) => service.active === "yes").map((service) => ({
      service_id: service.service_id,
      name: service.name,
      price_usd: service.price_usd,
      duration_minutes: service.duration_minutes,
    })),
  };
}

function bookAppointment({ settings, services, now, request, store }) {
  return store.withLock(() => {
    const service = services.find((row) => row.service_id === request.service_id);
    const decision = canBook({
      settings,
      service,
      bookings: store.readBookings(),
      now,
      date: String(request.date || ""),
      start_time: String(request.start_time || ""),
    });
    if (!decision.ok) return failure(decision.reason);

    const booking = {
      booking_id: store.nextId(),
      created_at: salonTimestamp(now, settings.timeZone),
      service_id: service.service_id,
      date: String(request.date),
      start_time: String(request.start_time),
      end_time: decision.end_time,
      customer_name: String(request.customer_name || "").trim(),
      customer_email: String(request.customer_email || "").trim(),
      customer_phone: String(request.customer_phone || "").trim(),
      status: "confirmed",
      email_opt_out: "",
      owner_notified_at: "",
      reminder_sent_at: "",
      review_sent_at: "",
    };
    const errors = validateBooking(booking);
    if (errors.length > 0) return failure("invalid");
    store.append(booking);
    return {
      ok: true,
      booking,
      message: `You're booked for ${service.name} on ${booking.date} at ${booking.start_time}. To cancel or reschedule, call ${settings.phone}.`,
    };
  });
}

function failure(reason) {
  return { ok: false, reason, message: MESSAGES[reason] };
}
