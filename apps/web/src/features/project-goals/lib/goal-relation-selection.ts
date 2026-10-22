import type { ProjectGoalSource } from "@cantiara/api/project-goals";

export interface GoalRelationChange {
  attached: boolean;
  baseRevision: number;
  kind: "Related" | "Contributes to Goal";
  source: ProjectGoalSource;
}

export function selectionKey(source: ProjectGoalSource) {
  return JSON.stringify([source.recordType, source.recordId]);
}
