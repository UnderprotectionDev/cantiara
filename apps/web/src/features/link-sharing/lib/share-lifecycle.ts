import {
  researchSessionTimeInput,
  researchSessionTimestamp,
} from "@/features/research-sessions/lib/research-session-time";

/** The optional expiry is a wall clock in the founder's profile time zone. */
export type ExpiryAction = "extend" | "reopen" | "reshare";

/**
 * The picker value (`yyyy-MM-ddTHH:mm` in the profile time zone, or empty for
 * no expiry) as the ISO instant the server stores; a skipped or repeated wall
 * time is refused rather than guessed.
 */
export function expiryInstant(input: string, timeZone: string) {
  return researchSessionTimestamp(input, timeZone);
}

export function expiryInput(expiresAt: string | null, timeZone: string) {
  return expiresAt ? researchSessionTimeInput(expiresAt, timeZone) : "";
}

/** `2026-10-30 14:00 (Europe/Istanbul)`, or `No expiry`. */
export function expiryLabel(expiresAt: string | null, timeZone: string) {
  return expiresAt
    ? `${expiryInput(expiresAt, timeZone).replace("T", " ")} (${timeZone})`
    : "No expiry";
}

/** Whether an instant is still ahead of now; the server checks again. */
export function isFutureInstant(instant: string | null, now = Date.now()) {
  return instant === null || new Date(instant).getTime() > now;
}

export function defaultNewExpiry(timeZone: string, now = new Date()) {
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return researchSessionTimeInput(week.toISOString(), timeZone);
}
