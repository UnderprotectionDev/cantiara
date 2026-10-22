import type { WorkspaceOverviewSavedListColumnId } from "@cantiara/api/workspace-overview";

export const COLUMN_LABELS: Record<WorkspaceOverviewSavedListColumnId, string> =
  {
    archive: "Archive",
    areas: "Project areas",
    name: "Project",
    stage: "Stage",
    status: "Status",
    targetDate: "Target date",
  };
