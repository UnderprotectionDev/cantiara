import { format, isValid, parseISO } from "date-fns";

/** A plain-language value for one previous–next side. */
export function activityValueText(value: string | null, truncated: boolean) {
  if (value === null) {
    return "empty";
  }
  return truncated ? `${value}…` : value;
}

/** Local date and time of one history entry; the raw ISO value is the fallback. */
export function activityTimeText(iso: string) {
  const parsed = parseISO(iso);
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd HH:mm") : iso;
}

export function activityActorText(
  kind: string,
  actorId: string,
  authorizingUserId: string | null,
) {
  if (kind === "Authorized integration") {
    return `${kind} ${actorId}${authorizingUserId ? ` (authorized by ${authorizingUserId})` : ""}`;
  }
  return kind === "User" ? "User" : kind;
}
