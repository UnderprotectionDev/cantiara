import {
  PROJECT_AREA_OPTIONS,
  type ProjectArea,
} from "@cantiara/api/project-shell";

import { projectAreaNavigationHash } from "./project-area-navigation";

export const ALWAYS_REACHABLE_SURFACES = [
  "Overview",
  "Tags",
  "Smart Collection",
  "All Tools",
  "Project History",
  "Project Updates",
  "Share",
  "Trash",
  "Shares and Publications",
] as const;
export const ALL_PROJECT_AREAS = PROJECT_AREA_OPTIONS;
export const CONFIGURATION_HOST_GROUPS = ["Project", "Work"] as const;
export type ConfigurationHostGroup = (typeof CONFIGURATION_HOST_GROUPS)[number];
export type NavigationSurface =
  | (typeof ALWAYS_REACHABLE_SURFACES)[number]
  | ProjectArea;

export const NAVIGATION_LINK_BASE =
  "relative inline-flex min-h-11 min-w-max items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-full";

export const CONFIGURATION_HOSTS = [
  {
    group: "Work",
    label: "Backlog",
    message:
      "Choose whether this Project sends a signal when Work reaches its Reappear date.",
  },
  {
    group: "Project",
    label: "Project areas",
    message:
      "Enable, hide, and pin ready Project areas. These controls only change Project navigation; they do not create, move, or delete records.",
  },
  {
    group: "Project",
    label: "Stages",
    message:
      "Stage names and presentation order open here; removing a stage does not delete main records.",
  },
  {
    group: "Work",
    label: "Work statuses",
    message:
      "Work status names open here; Not Started, In Progress, Blocked, and Closed semantics remain protected.",
  },
  {
    group: "Work",
    label: "Custom field",
    message: "No schema is defined here.",
  },
  {
    group: "Work",
    label: "Work Template",
    message: "Define optional start context without changing existing Work.",
  },
  {
    group: "Work",
    label: "Record Action",
    message:
      "Define fixed steps for one Work record from the closed field and membership catalog.",
  },
  {
    group: "Work",
    label: "Priority metrics",
    message:
      "Priority metric definitions open here; Work values remain with their source records.",
  },
  {
    group: "Work",
    label: "Saved views",
    message:
      "Saved view definitions open here; this entry does not change Planning membership.",
  },
  {
    group: "Work",
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
export const PRIORITY_MAP_HASH = "priority-map";
export const CONFIGURATION_MODE_HASH = "configuration";

export const DAILY_ACTION_MESSAGES: Record<DailyAction, string> = {
  Create:
    "Create remains outside Configuration Mode. This Project Shell entry does not create sample Work.",
  Edit: "Edit remains outside Configuration Mode. Project configuration does not change daily content.",
  Status:
    "Status remains outside Configuration Mode. Project stages do not write Work status.",
  Planning:
    "Planning remains outside Configuration Mode. Saved views are a separate Project configuration entry.",
};

/** The Project-level `Story Timeline` of `Project History`; never the landing surface. */
export const PROJECT_HISTORY_HASH = "project-history";
/** The Manual Project Updates chronology (`Project Update` entries); never the landing surface. */
export const PROJECT_UPDATES_HASH = "project-updates";
/** The `Share` surface: closed-world preview and scope approval for a link share. */
export const SHARE_HASH = "share";
/** The `Trash` surface: Trash entries and `Move to Trash`; never the landing surface. */
export const TRASH_HASH = "trash";
/** The `Shares and Publications` directory of every Dış yüzey of the Project. */
export const SHARES_AND_PUBLICATIONS_HASH = "shares-and-publications";
export const BACKLOG_HASH = "backlog";
export const ROADMAP_HASH = "roadmap";
const WORK_RELATIONS_HASH_PREFIX = "work-relations-";
const WORK_RECORD_HASH_PREFIX = "work-";
const DOCUMENT_RECORD_HASH_PREFIX = "document-";
const DOCUMENT_SECTION_RECORD_HASH_PREFIX = "document-section:";
const PROJECT_SOURCE_RECORD_HASH_PREFIXES = {
  "Validation Record": "source-validation-record-",
  Assumption: "source-assumption-",
  Decision: "source-decision-",
  "Open Question": "source-open-question-",
  Milestone: "source-milestone-",
  "Project Release": "source-project-release-",
  "Production Incident": "source-production-incident-",
  Risk: "source-risk-",
} as const;

export type ProjectSourceRecordType =
  keyof typeof PROJECT_SOURCE_RECORD_HASH_PREFIXES;

export function projectSourceRecordHash(
  sourceType: ProjectSourceRecordType,
  sourceId: string,
) {
  return `${PROJECT_SOURCE_RECORD_HASH_PREFIXES[sourceType]}${encodeURIComponent(sourceId)}`;
}

export function projectSourceRecordFromHash(hash: string) {
  for (const [sourceType, prefix] of Object.entries(
    PROJECT_SOURCE_RECORD_HASH_PREFIXES,
  ) as [ProjectSourceRecordType, string][]) {
    if (hash.startsWith(prefix)) {
      try {
        const sourceId = decodeURIComponent(hash.slice(prefix.length));
        return sourceId ? { sourceId, sourceType } : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function workRecordHash(workId: string) {
  return `${WORK_RECORD_HASH_PREFIX}${encodeURIComponent(workId)}`;
}

// A Test Gap is not a Project source record: it owns the Tests area, so its
// hash opens that area with the record anchored inside it.
export const TEST_GAP_RECORD_HASH_PREFIX = "source-test-gap-";

export function testGapRecordHash(gapId: string) {
  return `${TEST_GAP_RECORD_HASH_PREFIX}${encodeURIComponent(gapId)}`;
}

export function testGapRecordFromHash(hash: string): string | null {
  if (!hash.startsWith(TEST_GAP_RECORD_HASH_PREFIX)) {
    return null;
  }
  try {
    const gapId = decodeURIComponent(
      hash.slice(TEST_GAP_RECORD_HASH_PREFIX.length),
    );
    return gapId || null;
  } catch {
    return null;
  }
}

// Planned Test Cases, Test Handoffs, Test Sessions and Test Assessments also
// own the Tests area: their anchored hash opens it, like a Test Gap does.
export const TESTS_AREA_RECORD_HASH_PREFIXES = {
  "Planned Test Case": "planned-test-case-",
  "Test Assessment": "test-assessment-",
  "Test Handoff": "test-handoff-",
  "Test Session": "test-session-",
} as const;

export type TestsAreaRecordType = keyof typeof TESTS_AREA_RECORD_HASH_PREFIXES;

export function testsAreaRecordHash(
  recordType: TestsAreaRecordType,
  recordId: string,
) {
  return `${TESTS_AREA_RECORD_HASH_PREFIXES[recordType]}${encodeURIComponent(recordId)}`;
}

export function isTestsAreaRecordHash(hash: string) {
  return Object.values(TESTS_AREA_RECORD_HASH_PREFIXES).some((prefix) =>
    hash.startsWith(prefix),
  );
}

export function documentRecordHash(documentId: string) {
  return `${DOCUMENT_RECORD_HASH_PREFIX}${encodeURIComponent(documentId)}`;
}

export function documentSectionRecordHash(
  documentId: string,
  sectionId: string,
) {
  return `${DOCUMENT_SECTION_RECORD_HASH_PREFIX}${encodeURIComponent(documentId)}:${encodeURIComponent(sectionId)}`;
}

export function documentRecordFromHash(
  hash: string,
): { documentId: string; sectionId?: string } | null {
  if (hash.startsWith(DOCUMENT_SECTION_RECORD_HASH_PREFIX)) {
    const target = hash.slice(DOCUMENT_SECTION_RECORD_HASH_PREFIX.length);
    const separator = target.indexOf(":");
    if (
      separator <= 0 ||
      separator === target.length - 1 ||
      target.indexOf(":", separator + 1) !== -1
    ) {
      return null;
    }
    try {
      const documentId = decodeURIComponent(target.slice(0, separator));
      const sectionId = decodeURIComponent(target.slice(separator + 1));
      return documentId && sectionId ? { documentId, sectionId } : null;
    } catch {
      return null;
    }
  }
  if (!hash.startsWith(DOCUMENT_RECORD_HASH_PREFIX)) {
    return null;
  }
  try {
    const documentId = decodeURIComponent(
      hash.slice(DOCUMENT_RECORD_HASH_PREFIX.length),
    );
    return documentId ? { documentId } : null;
  } catch {
    return null;
  }
}

/** The Work id of a `work-<id>` record hash, or null. */
export function workRecordIdFromHash(hash: string) {
  if (
    !isWorkRecordHash(hash) ||
    Object.values(DAILY_ACTION_HASHES).includes(hash)
  ) {
    return null;
  }
  try {
    return (
      decodeURIComponent(hash.slice(WORK_RECORD_HASH_PREFIX.length)) || null
    );
  } catch {
    return null;
  }
}

export function workRecordHref(projectId: string, workId: string) {
  return `/projects/${encodeURIComponent(projectId)}#${workRecordHash(workId)}`;
}

/** The project-shell hash of the `Spec Change Review` queue. */
export const SPEC_CHANGE_REVIEW_HASH = "spec-change-reviews";

export function workRelationsHash(workId: string) {
  return `${WORK_RELATIONS_HASH_PREFIX}${encodeURIComponent(workId)}`;
}

export function isWorkRecordHash(hash: string) {
  return (
    hash.startsWith(WORK_RECORD_HASH_PREFIX) &&
    !hash.startsWith(WORK_RELATIONS_HASH_PREFIX)
  );
}

export function isWorkRelationsHash(hash: string) {
  return hash.startsWith(WORK_RELATIONS_HASH_PREFIX);
}

const DIRECT_SURFACE_BY_HASH = new Map<string, NavigationSurface>([
  ["all-tools", "All Tools"],
  ["tags", "Tags"],
  [PROJECT_HISTORY_HASH, "Project History"],
  [PROJECT_UPDATES_HASH, "Project Updates"],
  [SHARE_HASH, "Share"],
  [TRASH_HASH, "Trash"],
  [SHARES_AND_PUBLICATIONS_HASH, "Shares and Publications"],
]);

export function navigationSurfaceFromHash(
  hash: string,
  enabledAreas: readonly ProjectArea[],
  hiddenAreas: readonly ProjectArea[],
  visiblePinnedAreas: readonly ProjectArea[],
): NavigationSurface {
  if (!hash) {
    return "Overview";
  }
  const direct = DIRECT_SURFACE_BY_HASH.get(hash);
  if (direct) {
    return direct;
  }
  if (
    hash === "smart-collections" ||
    hash.startsWith("smart-collection-view-")
  ) {
    return "Smart Collection";
  }
  if (
    (hash === "technical-diagrams" || hash.startsWith("technical-diagram-")) &&
    enabledAreas.includes("Technical Diagrams") &&
    !hiddenAreas.includes("Technical Diagrams")
  ) {
    return "Technical Diagrams";
  }
  if (
    hash.startsWith("moodboard-") &&
    enabledAreas.includes("Design") &&
    !hiddenAreas.includes("Design")
  ) {
    return "Design";
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
  if (
    hash.startsWith(DOCUMENT_RECORD_HASH_PREFIX) &&
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
    hash === BACKLOG_HASH ||
    hash === ROADMAP_HASH ||
    hash === PRIORITY_MAP_HASH ||
    dailyActionFromHash(hash) !== null ||
    isWorkRecordHash(hash) ||
    isWorkRelationsHash(hash)
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
  if (surface === "Project History") {
    return PROJECT_HISTORY_HASH;
  }
  if (surface === "Project Updates") {
    return PROJECT_UPDATES_HASH;
  }
  if (surface === "Share") {
    return SHARE_HASH;
  }
  if (surface === "Trash") {
    return TRASH_HASH;
  }
  if (surface === "Shares and Publications") {
    return SHARES_AND_PUBLICATIONS_HASH;
  }
  if (surface === "Smart Collection") {
    return "smart-collections";
  }
  return projectAreaNavigationHash(surface);
}

export function navigationSlug(surface: string) {
  return surface.toLowerCase().replaceAll(" ", "-");
}

export function configurationHostId(label: ConfigurationHost) {
  return `configuration-host-${navigationSlug(label)}`;
}
