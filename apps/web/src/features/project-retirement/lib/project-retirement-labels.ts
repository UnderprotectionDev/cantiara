import type { ArchiveStoppedActivity } from "@cantiara/api/project-retirement";

/** What stops while a Project is archived, in the words the preview shows. */
export const STOPPED_ACTIVITY_LABELS: Record<ArchiveStoppedActivity, string> = {
  automation: "Automations stop",
  "github-sync": "GitHub sync stops",
  "normal-write": "Normal edits are refused",
  reminder: "Reminders stop",
};

export function stoppedActivityLabel(activity: string) {
  return (
    STOPPED_ACTIVITY_LABELS[activity as ArchiveStoppedActivity] ?? activity
  );
}
