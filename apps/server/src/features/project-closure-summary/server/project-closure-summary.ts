import {
  type ClosureSummaryCandidate,
  closureSummaryDraftInputSchema,
  closureSummarySourcesInputSchema,
  deriveClosureSummaryPreview,
  groupClosureSummaryCandidates,
  isClosureSummaryProjectStatus,
  type ProjectClosureSummaryAccess,
} from "@cantiara/api/project-closure-summary";

/**
 * Project Closure Summary behavior (spec 70, Closure Summary Draft). The draft
 * is derived live from the owner records behind the read-only
 * `ProjectClosureSummarySources` port. This module has no write path: it
 * persists no Belge, no search or export item and no closure record, and it
 * writes no commentary, result or success sentence.
 */

export class ProjectClosureSummaryProjectNotFoundError extends Error {
  readonly code = "PROJECT_CLOSURE_SUMMARY_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ProjectClosureSummaryProjectNotFoundError";
  }
}

export class ProjectClosureSummaryProjectNotClosedError extends Error {
  readonly code = "PROJECT_CLOSURE_SUMMARY_PROJECT_NOT_CLOSED" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is neither completed nor abandoned.`);
    this.name = "ProjectClosureSummaryProjectNotClosedError";
  }
}

export class ProjectClosureSummarySourceNotFoundError extends Error {
  readonly code = "PROJECT_CLOSURE_SUMMARY_SOURCE_NOT_FOUND" as const;

  constructor(recordId: string) {
    super(`Source ${recordId} is unavailable for this Project.`);
    this.name = "ProjectClosureSummarySourceNotFoundError";
  }
}

export interface ProjectClosureSummarySources {
  /**
   * The selectable, live, same-Project records the account owns: not Trash,
   * not archived, completed Work only. Nothing here can write.
   */
  candidates: (
    accountId: string,
    projectId: string,
  ) => Promise<ClosureSummaryCandidate[]>;
  /** The Project lifecycle status, or null when the account owns no such Project. */
  projectStatus: (
    accountId: string,
    projectId: string,
  ) => Promise<string | null>;
}

export function createProjectClosureSummary(
  sources: ProjectClosureSummarySources,
): ProjectClosureSummaryAccess {
  async function statusOf(accountId: string, projectId: string) {
    const status = await sources.projectStatus(accountId, projectId);
    if (status === null) {
      throw new ProjectClosureSummaryProjectNotFoundError(projectId);
    }
    return status;
  }

  return {
    async draft(accountId, rawInput) {
      const input = closureSummaryDraftInputSchema.parse(rawInput);
      const status = await statusOf(accountId, input.projectId);
      if (!isClosureSummaryProjectStatus(status)) {
        throw new ProjectClosureSummaryProjectNotClosedError(input.projectId);
      }
      const candidates = await sources.candidates(accountId, input.projectId);
      const selected = input.sources.map((ref) => {
        const found = candidates.find(
          (candidate) =>
            candidate.recordType === ref.recordType &&
            candidate.recordId === ref.recordId,
        );
        if (!found) {
          throw new ProjectClosureSummarySourceNotFoundError(ref.recordId);
        }
        return found;
      });
      return deriveClosureSummaryPreview(input.projectId, selected);
    },
    async sources(accountId, rawInput) {
      const input = closureSummarySourcesInputSchema.parse(rawInput);
      const status = await statusOf(accountId, input.projectId);
      if (!isClosureSummaryProjectStatus(status)) {
        return {
          eligible: false,
          groups: [],
          projectId: input.projectId,
          projectStatus: status,
        };
      }
      const candidates = await sources.candidates(accountId, input.projectId);
      return {
        eligible: true,
        groups: groupClosureSummaryCandidates(candidates),
        projectId: input.projectId,
        projectStatus: status,
      };
    },
  };
}
