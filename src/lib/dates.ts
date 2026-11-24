/**
 * Time zone helpers. Timestamps are stored in UTC; calendar dates ("YYYY-MM-DD") and
 * wall-clock times ("HH:mm") are always interpreted in the organization's time zone.
 */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedFields(instant: Date, timeZone: string) {
  const fields: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") fields[part.type] = Number(part.value);
  }
  return {
    year: fields.year ?? 0,
    month: fields.month ?? 0,
    day: fields.day ?? 0,
    hour: fields.hour ?? 0,
    minute: fields.minute ?? 0,
    second: fields.second ?? 0,
  };
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
function offsetMs(instant: Date, timeZone: string) {
  const f = zonedFields(instant, timeZone);
  const asUtc = Date.UTC(
    f.year,
    f.month - 1,
    f.day,
    f.hour,
    f.minute,
    f.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Converts a wall-clock date and time in the zone to a UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The offset depends on the instant, which depends on the offset; two passes settle
  // it, including on daylight saving transition days.
  const firstGuess = wallAsUtc - offsetMs(new Date(wallAsUtc), timeZone);
  return new Date(wallAsUtc - offsetMs(new Date(firstGuess), timeZone));
}

export function toZonedDate(instant: Date | string, timeZone: string) {
  const f = zonedFields(new Date(instant), timeZone);
  return `${f.year}-${pad(f.month)}-${pad(f.day)}`;
}

export function toZonedTime(instant: Date | string, timeZone: string) {
  const f = zonedFields(new Date(instant), timeZone);
  return `${pad(f.hour)}:${pad(f.minute)}`;
}

/** Minutes since midnight in the zone. */
export function zonedMinutes(instant: Date | string, timeZone: string) {
  const f = zonedFields(new Date(instant), timeZone);
  return f.hour * 60 + f.minute;
}

export function todayInZone(timeZone: string, now = new Date()) {
  return toZonedDate(now, timeZone);
}

export function addDays(date: string, days: number) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

/** Monday of the week containing the date. */
export function startOfWeek(date: string) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

/** UTC bounds [start, end) of the given calendar days in the zone. */
export function zonedDayRange(
  fromDate: string,
  toDateExclusive: string,
  timeZone: string,
) {
  return {
    start: zonedToUtc(fromDate, "00:00", timeZone),
    end: zonedToUtc(toDateExclusive, "00:00", timeZone),
  };
}

export function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return addDays(date, 0) === date;
}

export function formatDate(instant: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(instant));
}

/** Formats a plain calendar date ("YYYY-MM-DD") without shifting it across zones. */
export function formatCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatTime(instant: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

export function formatTimeRange(start: string, end: string, timeZone: string) {
  return `${formatTime(start, timeZone)} - ${formatTime(end, timeZone)}`;
}

export function durationMinutes(start: string, end: string) {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60_000,
  );
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
