import {
  deriveStoryTimeline,
  type ProjectHistoryAccess,
  type StoryScope,
  type StoryTimelineFacts,
  type StoryTimelineInput,
  storyTimelineInputSchema,
} from "@cantiara/api/project-history";

/**
 * Project History behavior (spec 68, Story Timeline). The story is derived live
 * on every read from the owner records behind the `ProjectHistorySources` read
 * port. This module has no write path at all: it stores no event, mints no
 * Dikkat sinyali and writes no summary, release note or narrative.
 */

export class ProjectHistoryProjectNotFoundError extends Error {
  readonly code = "PROJECT_HISTORY_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ProjectHistoryProjectNotFoundError";
  }
}

export class ProjectHistoryWorkNotFoundError extends Error {
  readonly code = "PROJECT_HISTORY_WORK_NOT_FOUND" as const;

  constructor(workId: string) {
    super(`Work ${workId} was not found.`);
    this.name = "ProjectHistoryWorkNotFoundError";
  }
}

export class ProjectHistoryWorkNotFeatureError extends Error {
  readonly code = "PROJECT_HISTORY_WORK_NOT_FEATURE" as const;

  constructor(workId: string) {
    super(`Work ${workId} is not a Feature.`);
    this.name = "ProjectHistoryWorkNotFeatureError";
  }
}

export type ProjectHistoryScopeLookup =
  | { scope: StoryScope; status: "found" }
  | { status: "project-not-found" | "work-not-found" | "work-not-feature" };

/**
 * Read-only port to the owner records. Each kind resolves to its realized
 * events or to an explicit unavailable reason; it is never silently empty.
 * Nothing here can write: the port has no mutating member.
 */
export interface ProjectHistorySources {
  read: (
    accountId: string,
    scope: StoryScope,
  ) => Promise<StoryTimelineFacts["sources"]>;
  /** Resolves the scope when the account owns the Project (and the Feature). */
  resolveScope: (
    accountId: string,
    input: StoryTimelineInput,
  ) => Promise<ProjectHistoryScopeLookup>;
}

export function createProjectHistory(
  sources: ProjectHistorySources,
): ProjectHistoryAccess {
  return {
    async storyTimeline(accountId, rawInput) {
      const input = storyTimelineInputSchema.parse(rawInput);
      const lookup = await sources.resolveScope(accountId, input);
      if (lookup.status === "project-not-found") {
        throw new ProjectHistoryProjectNotFoundError(input.projectId);
      }
      if (lookup.status === "work-not-found" && input.scope === "Feature") {
        throw new ProjectHistoryWorkNotFoundError(input.workId);
      }
      if (lookup.status === "work-not-feature" && input.scope === "Feature") {
        throw new ProjectHistoryWorkNotFeatureError(input.workId);
      }
      if (lookup.status !== "found") {
        throw new ProjectHistoryProjectNotFoundError(input.projectId);
      }
      return deriveStoryTimeline({
        scope: lookup.scope,
        sources: await sources.read(accountId, lookup.scope),
      });
    },
  };
}
