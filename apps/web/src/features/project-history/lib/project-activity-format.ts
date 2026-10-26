import type { ProjectActivityRow } from "@cantiara/api/project-activity";
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

/** The actor kind is never collapsed; an integration also names itself and who authorized it. */
export function activityActorText(actor: ProjectActivityRow["actor"]) {
  if (actor.kind === "Authorized integration") {
    return `${actor.kind} ${actor.actorId}${actor.authorizingUserId ? ` (authorized by ${actor.authorizingUserId})` : ""}`;
  }
  return actor.kind;
}
