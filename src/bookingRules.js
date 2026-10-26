const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function readSettings(rows) {
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

export function openSlots({ settings, service, bookings = [], now }) {
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

export function canBook({ settings, service, bookings = [], now, date, start_time }) {
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

export function bookingsToNotifyOwner(bookings) {
  return bookings.filter((booking) => booking.status === "confirmed" && booking.owner_notified_at === "");
}

export function bookingsToRemind({ settings, bookings, now }) {
  assertNow(now);
  const tomorrow = addDays(salonDate(now, settings.timeZone), 1);
  return bookings.filter((booking) => isCustomerMailDue(booking) && booking.reminder_sent_at === "" && booking.date === tomorrow);
}

export function bookingsToReview({ settings, bookings, now }) {
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

export function salonTimestamp(instant, timeZone) {
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
