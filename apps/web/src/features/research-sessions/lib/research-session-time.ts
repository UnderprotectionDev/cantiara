import { isValid, parseISO } from "date-fns";

/** The native datetime input is a wall clock in the saved Account time zone. */
export function researchSessionTimeInput(timestamp: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parseISO(timestamp));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}T${values.get("hour")}:${values.get("minute")}`;
}

export function researchSessionTimestamp(
  input: string,
  timeZone: string,
  originalTimestamp?: string | null,
) {
  if (!input) {
    return null;
  }
  if (
    originalTimestamp &&
    researchSessionTimeInput(originalTimestamp, timeZone) === input
  ) {
    return originalTimestamp;
  }
  const wallClock = parseISO(`${input}:00Z`);
  if (!isValid(wallClock) || wallClock.toISOString().slice(0, 16) !== input) {
    throw new RangeError("Enter a valid Time.");
  }
  // Collect offsets on both sides of a seasonal clock change. Match the
  // resulting instants back to the wall clock rather than silently shifting
  // a nonexistent time or choosing one of two repeated times.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(wallClock.getTime() + hours * 3_600_000);
    const local = parseISO(
      `${researchSessionTimeInput(sample.toISOString(), timeZone)}:00Z`,
    );
    offsets.add(local.getTime() - sample.getTime());
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wallClock.getTime() - offset).toISOString())
    .filter((instant) => researchSessionTimeInput(instant, timeZone) === input);
  if (candidates.length !== 1) {
    throw new RangeError(
      "Time is skipped or repeated by a clock change in your account time zone. Choose another Time.",
    );
  }
  return candidates[0];
}
