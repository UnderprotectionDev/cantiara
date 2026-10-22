import type { GitHubConnection } from "@cantiara/api/github-integration";
import { format } from "date-fns";

/** Date and time as the founder reads them; the ISO string stays in `dateTime`. */
export function formatSyncTime(iso: string) {
  return format(new Date(iso), "PP p");
}

/** Plain outcome sentence for a Sync now answer; nothing is ever "synced" silently. */
export function syncNowMessage(result: {
  applied: number;
  outcome: "disconnected" | "failed" | "paused" | "ran" | "rate-limited";
  stale: number;
}) {
  switch (result.outcome) {
    case "ran":
      return `Synced. ${result.applied} GitHub records updated, ${result.stale} already newer.`;
    case "paused":
      return "Nothing was read: this link is paused.";
    case "disconnected":
      return "Nothing was read: this link is disconnected.";
    case "rate-limited":
      return "GitHub asked us to wait. Nothing was read yet.";
    default:
      return "The sync failed. The last error is shown on the link.";
  }
}

/** Which of the three life states may offer which action. */
export function linkActionsFor(connection: GitHubConnection) {
  return {
    canDisconnect: connection !== "Disconnected",
    canReconnect: connection !== "Connected",
    canSyncNow: connection === "Connected",
  };
}
