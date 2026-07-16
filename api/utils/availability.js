const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Validate and normalize seller availability windows.
 * @returns {{ windows: Array, timezone: string, note: string|null }}
 */
export const parseAvailabilityInput = (body = {}) => {
  const rawWindows = body.windows ?? body.availability;
  if (!Array.isArray(rawWindows)) {
    const err = new Error(
      "Provide an availability windows array (e.g. { windows: [{ dayOfWeek, startTime, endTime }] })."
    );
    err.status = 400;
    throw err;
  }

  if (rawWindows.length > 50) {
    const err = new Error("You can set at most 50 availability windows.");
    err.status = 400;
    throw err;
  }

  const windows = rawWindows.map((slot, index) => {
    const dayOfWeek = Number(slot.dayOfWeek);
    const startTime =
      typeof slot.startTime === "string" ? slot.startTime.trim() : "";
    const endTime =
      typeof slot.endTime === "string" ? slot.endTime.trim() : "";

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      const err = new Error(
        `Window[${index}]: dayOfWeek must be an integer 0 (Sunday) through 6 (Saturday).`
      );
      err.status = 400;
      throw err;
    }

    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      const err = new Error(
        `Window[${index}]: startTime and endTime must be HH:mm (24-hour).`
      );
      err.status = 400;
      throw err;
    }

    if (toMinutes(startTime) >= toMinutes(endTime)) {
      const err = new Error(
        `Window[${index}]: startTime must be before endTime.`
      );
      err.status = 400;
      throw err;
    }

    return { dayOfWeek, startTime, endTime };
  });

  // Sort for stable display
  windows.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });

  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : typeof body.availabilityTimezone === "string" &&
          body.availabilityTimezone.trim()
        ? body.availabilityTimezone.trim()
        : "Africa/Accra";

  let note = null;
  if (body.note !== undefined || body.availabilityNote !== undefined) {
    const raw = body.note ?? body.availabilityNote;
    if (raw !== null && raw !== undefined && typeof raw !== "string") {
      const err = new Error("availability note must be a string.");
      err.status = 400;
      throw err;
    }
    note = typeof raw === "string" ? raw.trim().slice(0, 500) : null;
  }

  return { windows, timezone, note };
};

/**
 * Whether "now" falls inside any window (best-effort using timezone offset via Intl).
 * For booking UX cues — not a hard lock on orders.
 */
export const isAvailableAt = (
  windows = [],
  timezone = "Africa/Accra",
  date = new Date()
) => {
  if (!Array.isArray(windows) || windows.length === 0) return null;

  let dayOfWeek;
  let hhmm;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    dayOfWeek = map[weekday];
    hhmm = `${hour}:${minute}`;
  } catch {
    dayOfWeek = date.getUTCDay();
    hhmm = `${String(date.getUTCHours()).padStart(2, "0")}:${String(
      date.getUTCMinutes()
    ).padStart(2, "0")}`;
  }

  if (dayOfWeek === undefined || !hhmm) return null;
  const nowMins = toMinutes(hhmm);

  return windows.some(
    (w) =>
      w.dayOfWeek === dayOfWeek &&
      nowMins >= toMinutes(w.startTime) &&
      nowMins < toMinutes(w.endTime)
  );
};
