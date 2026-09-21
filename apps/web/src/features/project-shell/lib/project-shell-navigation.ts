import {
  PROJECT_AREA_OPTIONS,
  type ProjectArea,
} from "@cantiara/api/project-shell";

import { projectAreaNavigationHash } from "./project-area-navigation";

export const ALWAYS_REACHABLE_SURFACES = [
  "Overview",
  "Tags",
  "All Tools",
] as const;
export const ALL_PROJECT_AREAS = PROJECT_AREA_OPTIONS;
export type NavigationSurface =
  | (typeof ALWAYS_REACHABLE_SURFACES)[number]
  | ProjectArea;

export const NAVIGATION_LINK_BASE =
  "relative inline-flex min-w-max items-center rounded-md px-3 py-2 text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-full";

export const CONFIGURATION_HOSTS = [
  {
    description:
      "Open the host for Project stages. Stage state is presentation metadata and does not write Work status.",
    label: "Stages",
    message:
      "Stage names and presentation order open here; removing a stage does not delete main records.",
  },
  {
    description:
      "Open the host for user-facing Work status names while protected semantics remain unchanged.",
    label: "Work statuses",
    message:
      "Work status names open here; Not Started, In Progress, Blocked, and Closed semantics remain protected.",
  },
  {
    description:
      "Open the host for enabled Project areas. Overview and All Tools stay reachable.",
    label: "Project areas",
    message:
      "Enable, hide, and pin ready Project areas without creating records.",
  },
  {
    description:
      "Open the host for project-scoped fields. Field types and values belong to the Custom field feature.",
    label: "Custom field",
    message: "No schema is defined here.",
  },
  {
    description:
      "Open the host for project priority criteria without creating a scalar priority field.",
    label: "Priority metrics",
    message:
      "Priority metric definitions open here; Work values remain with their source records.",
  },
  {
    description:
      "Open the host for named Work views. Planning remains a daily action outside this mode.",
    label: "Saved views",
    message:
      "Saved view definitions open here; this entry does not change Planning membership.",
  },
  {
    description:
      "Open the host for Work Context Card presentation without changing its layout engine.",
    label: "Work Context Card layout",
    message:
      "No layout is changed here. The Work Context Card feature owns its layout engine.",
  },
] as const;

export type ConfigurationHost = (typeof CONFIGURATION_HOSTS)[number]["label"];

export const DAILY_ACTIONS = ["Create", "Edit", "Status", "Planning"] as const;
export type DailyAction = (typeof DAILY_ACTIONS)[number];
export const DAILY_ACTION_HASHES: Record<DailyAction, string> = {
  Create: "work-create",
  Edit: "work-edit",
  Planning: "work-planning",
  Status: "work-status",
};

export const DAILY_ACTION_MESSAGES: Record<DailyAction, string> = {
  Create:
    "Create remains outside Configuration Mode. This Project Shell entry does not create sample Work.",
  Edit: "Edit remains outside Configuration Mode. Project configuration does not change daily content.",
  Status:
    "Status remains outside Configuration Mode. Project stages do not write Work status.",
  Planning:
    "Planning remains outside Configuration Mode. Saved views are a separate Project configuration entry.",
};

const WORK_RELATIONS_HASH_PREFIX = "work-relations-";
const WORK_RECORD_HASH_PREFIX = "work-";

export function workRecordHash(workId: string) {
  return `${WORK_RECORD_HASH_PREFIX}${encodeURIComponent(workId)}`;
}

export function workRecordHref(projectId: string, workId: string) {
  return `/projects/${encodeURIComponent(projectId)}#${workRecordHash(workId)}`;
}

export function workRelationsHash(workId: string) {
  return `${WORK_RELATIONS_HASH_PREFIX}${encodeURIComponent(workId)}`;
}

export function navigationSurfaceFromHash(
  hash: string,
  enabledAreas: readonly ProjectArea[],
  hiddenAreas: readonly ProjectArea[],
  visiblePinnedAreas: readonly ProjectArea[],
): NavigationSurface {
  if (!hash) {
    return "Overview";
  }
  if (hash === "all-tools") {
    return "All Tools";
  }
  if (hash === "tags") {
    return "Tags";
  }
  if (
    isWorkSurfaceHash(hash) &&
    enabledAreas.includes("Work") &&
    !hiddenAreas.includes("Work")
  ) {
    return "Work";
  }
  if (
    hash === "documents" &&
    enabledAreas.includes("Documents") &&
    !hiddenAreas.includes("Documents")
  ) {
    return "Documents";
  }
  const visibleArea = PROJECT_AREA_OPTIONS.find(
    (area) =>
      enabledAreas.includes(area) &&
      !hiddenAreas.includes(area) &&
      projectAreaNavigationHash(area) === hash,
  );
  if (visibleArea) {
    return visibleArea;
  }
  const pinnedArea = visiblePinnedAreas.find(
    (area) => projectAreaNavigationHash(area) === hash,
  );
  return pinnedArea ?? "Overview";
}

export function dailyActionFromHash(hash: string) {
  return (
    DAILY_ACTIONS.find((action) => DAILY_ACTION_HASHES[action] === hash) ?? null
  );
}

export function isWorkSurfaceHash(hash: string) {
  return (
    hash === "work" ||
    dailyActionFromHash(hash) !== null ||
    hash.startsWith(WORK_RELATIONS_HASH_PREFIX)
  );
}

export function navigationHash(surface: NavigationSurface) {
  if (surface === "All Tools") {
    return "all-tools";
  }
  if (surface === "Overview") {
    return "overview";
  }
  if (surface === "Tags") {
    return "tags";
  }
  return projectAreaNavigationHash(surface);
}

export function navigationSlug(surface: string) {
  return surface.toLowerCase().replaceAll(" ", "-");
}

export function configurationHostId(label: ConfigurationHost) {
  return `configuration-host-${navigationSlug(label)}`;
}
