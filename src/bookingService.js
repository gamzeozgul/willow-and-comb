import { canBook, countOpenAppointments, readSettings, salonTimestamp } from "./bookingRules.js";
import { validateBooking, validateSettings } from "./sheetContract.js";

const MAX_UPCOMING_PER_EMAIL = 2;

const MESSAGES = {
  past: "That time has already passed.",
  "too-soon": "Please book at least 2 hours ahead.",
  "too-far": "That date is too far ahead.",
  closed: "The studio is closed that day.",
  "outside-hours": "That time is not available.",
  overlap: "That time was just taken. Please pick another.",
  inactive: "That service is no longer available.",
  "unknown-service": "Please choose a service.",
  invalid: "Please check the name and email.",
  "too-many": (phone) => `You already have two upcoming appointments. To book another, call ${phone}.`,
};

export function describeSettings(rows) {
  const errors = validateSettings(rows);
  if (errors.length > 0) {
    return { ok: false, message: `The studio settings need a fix: ${errors[0]}` };
  }
  return { ok: true, settings: readSettings(rows) };
}

export function publicCatalog(settings, services) {
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

export function bookAppointment({ settings, services, now, request, store }) {
  if (String(request.leave_blank || "").trim() !== "") return quietSuccess(settings, services, request);
  return store.withLock(() => {
    const bookings = store.readBookings();
    const service = services.find((row) => row.service_id === request.service_id);
    const decision = canBook({
      settings,
      service,
      bookings,
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
      customer_email: String(request.customer_email || "").trim().toLowerCase(),
      customer_phone: String(request.customer_phone || "").trim(),
      status: "confirmed",
      email_opt_out: "",
      owner_notified_at: "",
      reminder_sent_at: "",
      review_sent_at: "",
    };
    const errors = validateBooking(booking);
    if (errors.length > 0) return failure("invalid");
    const open = countOpenAppointments(bookings, booking.customer_email, now, settings.timeZone);
    if (open >= MAX_UPCOMING_PER_EMAIL) return failure("too-many", settings.phone);
    store.append(booking);
    return {
      ok: true,
      booking,
      message: `You're booked for ${service.name} on ${booking.date} at ${booking.start_time}. To cancel or reschedule, call ${settings.phone}.`,
    };
  });
}

function quietSuccess(settings, services, request) {
  const service = services.find((row) => row.service_id === request.service_id);
  const name = service ? service.name : "your visit";
  const date = String(request.date || "").trim();
  const start = String(request.start_time || "").trim();
  const when = date && start ? ` for ${name} on ${date} at ${start}` : "";
  return {
    ok: true,
    message: `You're booked${when}. To cancel or reschedule, call ${settings.phone}.`,
  };
}

function failure(reason, phone) {
  const text = MESSAGES[reason];
  return { ok: false, reason, message: typeof text === "function" ? text(phone) : text };
}
