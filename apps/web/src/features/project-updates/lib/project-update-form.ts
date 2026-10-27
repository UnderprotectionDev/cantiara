import {
  buildProjectOverview,
  type ProjectOverviewSources,
} from "@cantiara/api/project-overview";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import {
  PROJECT_UPDATE_LINK_TYPES,
  PROJECT_UPDATE_NARRATIVE_MAX,
  PROJECT_UPDATE_SNAPSHOT_BLOCKS,
  type ProjectUpdateLinkInput,
  type ProjectUpdateLinkType,
  type ProjectUpdateMark,
  type ProjectUpdateSnapshot,
  projectUpdateMarkSchema,
} from "@cantiara/api/project-updates";
import { z } from "zod";

/** A live record the founder may link an update to. */
export interface ProjectUpdateLinkCandidate {
  key: string;
  label: string;
  status: string | null;
  type: ProjectUpdateLinkType;
}

export interface ProjectUpdateFormDraft {
  /** Link keys (`<type>:<id>`) of the checked records. */
  links: string[];
  mark: ProjectUpdateMark | "";
  narrative: string;
}

export const EMPTY_PROJECT_UPDATE_DRAFT: ProjectUpdateFormDraft = {
  links: [],
  mark: "",
  narrative: "",
};

export const projectUpdateFormSchema = z.object({
  links: z.array(z.string()),
  mark: projectUpdateMarkSchema,
  narrative: z.string().trim().min(1).max(PROJECT_UPDATE_NARRATIVE_MAX),
});

export function projectUpdateLinkKey(link: ProjectUpdateLinkInput) {
  return `${link.targetType}:${link.targetId}`;
}

/** Back from `<type>:<id>`; the id may itself contain `:`. */
export function projectUpdateLinkFromKey(
  key: string,
): ProjectUpdateLinkInput | null {
  const separator = key.indexOf(":");
  const type = PROJECT_UPDATE_LINK_TYPES.find(
    (candidate) => candidate === key.slice(0, separator),
  );
  const targetId = key.slice(separator + 1);
  return type && targetId ? { targetId, targetType: type } : null;
}

/**
 * The Risk, Decision and Milestone records the update surface lists as link
 * choices, read from the same sources the Project overview uses.
 */
export function projectUpdateLinkCandidates(
  sources: ProjectOverviewSources,
): ProjectUpdateLinkCandidate[] {
  const groups = [
    ["Risk", sources.risks],
    ["Decision", sources.decisions],
    ["Milestone", sources.milestones],
  ] as const;
  return groups.flatMap(([type, records]) =>
    (records ?? []).map((record) => ({
      key: projectUpdateLinkKey({ targetId: record.id, targetType: type }),
      label: record.title,
      status: record.status ?? null,
      type,
    })),
  );
}

const SNAPSHOT_RECORD_LIMIT = 100;

/**
 * The summary blocks the update surface shows (Goals, active Stages,
 * Milestones, Decisions, Risks) taken from what the Project overview derives
 * live, trimmed to what the closed snapshot contract stores. It is a copy for
 * history, never a new source of truth.
 */
export function buildProjectUpdateSnapshot(
  project: ProjectProfile,
  sources: ProjectOverviewSources,
): ProjectUpdateSnapshot {
  const overview = buildProjectOverview(project, sources);
  const blocks = overview.modules.flatMap((module) => {
    const name = PROJECT_UPDATE_SNAPSHOT_BLOCKS.find(
      (candidate) => candidate === module.name,
    );
    return name
      ? [
          {
            name,
            records: module.records
              .slice(0, SNAPSHOT_RECORD_LIMIT)
              .map((record) => ({
                id: record.id,
                status: record.status ?? null,
                targetDate: record.targetDate ?? null,
                title: record.title.slice(0, 255),
              })),
          },
        ]
      : [];
  });
  return {
    blocks,
    lifecycle: overview.lifecycle,
    purpose: overview.purpose,
    targetDate: overview.targetDate,
  };
}
