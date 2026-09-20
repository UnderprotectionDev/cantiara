import type { WorkType } from "./work-lifecycle";

export const WORK_CONTEXT_INITIAL_FIELDS = [
  "Title",
  "Type",
  "Status",
  "Planning",
] as const;

export type WorkContextInitialField =
  (typeof WORK_CONTEXT_INITIAL_FIELDS)[number];

export type PreparedWorkContextSection =
  | "Affected Releases"
  | "Current Situation"
  | "Decisions"
  | "Dependencies"
  | "Description"
  | "Evidence"
  | "Evidence & Decisions"
  | "Expected Outcome"
  | "GitHub & Tests"
  | "Included Work"
  | "Problem/Opportunity"
  | "Related Work"
  | "Research Question"
  | "Risks & Open Questions"
  | "Sources & Evidence"
  | "Target Release"
  | "Observed/Expected Behavior";

export const PREPARED_WORK_CONTEXT_SECTIONS = {
  Bug: [
    "Observed/Expected Behavior",
    "Affected Releases",
    "Evidence",
    "GitHub & Tests",
  ],
  Feature: [
    "Problem/Opportunity",
    "Expected Outcome",
    "Evidence & Decisions",
    "Risks & Open Questions",
    "Included Work",
    "GitHub & Tests",
    "Target Release",
  ],
  Improvement: [
    "Current Situation",
    "Expected Outcome",
    "Evidence",
    "GitHub & Tests",
  ],
  Research: [
    "Research Question",
    "Sources & Evidence",
    "Decisions",
    "Related Work",
  ],
  Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const satisfies Record<WorkType, readonly PreparedWorkContextSection[]>;

export interface PreparedWorkContextLayout {
  initialFields: typeof WORK_CONTEXT_INITIAL_FIELDS;
  sections: readonly PreparedWorkContextSection[];
}

export function getPreparedWorkContextLayout(
  workType: WorkType,
): PreparedWorkContextLayout {
  return {
    initialFields: WORK_CONTEXT_INITIAL_FIELDS,
    sections: PREPARED_WORK_CONTEXT_SECTIONS[workType],
  };
}

export function nextPreparedWorkContextSection(
  workType: WorkType,
  visibleSections: readonly PreparedWorkContextSection[],
) {
  return (
    getPreparedWorkContextLayout(workType).sections.find(
      (section) => !visibleSections.includes(section),
    ) ?? null
  );
}
