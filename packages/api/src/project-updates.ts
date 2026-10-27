import { z } from "zod";

/**
 * Manual Project Updates seam (spec 69): the founder's dated, subjective
 * judgment of a Project. An update carries one of three closed marks, a short
 * narrative, optional links to Risk, Decision, Milestone or Work records, and a
 * read-only snapshot of the summary blocks the founder saw when saving.
 *
 * The seam is append-only: it has a read and a create, and no operation that
 * rewrites or removes a saved entry. It has no health score, no aggregate, no
 * "current" judgment, no Mission Control summary, no draft and no reminder
 * (reminders are a later ticket). Linked records stay live; their label and
 * status are read at request time and are never copied into the snapshot as a
 * new source of truth.
 */

export const PROJECT_UPDATE_LABEL = "Project Update";
export const PROJECT_UPDATES_LABEL = "Project Updates";
export const CREATE_PROJECT_UPDATE_LABEL = "Create Project Update";
export const PROJECT_UPDATE_OPEN_SOURCE_LABEL = "Open source record";

export const PROJECT_UPDATE_MARKS = [
  "On Track",
  "At Risk",
  "Off Track",
] as const;
export const projectUpdateMarkSchema = z.enum(PROJECT_UPDATE_MARKS);
export type ProjectUpdateMark = z.infer<typeof projectUpdateMarkSchema>;

export const PROJECT_UPDATE_LINK_TYPES = [
  "Risk",
  "Decision",
  "Milestone",
  "Work",
] as const;
export const projectUpdateLinkTypeSchema = z.enum(PROJECT_UPDATE_LINK_TYPES);
export type ProjectUpdateLinkType = z.infer<typeof projectUpdateLinkTypeSchema>;

/**
 * The summary blocks the update surface shows, a subset of what the Project
 * overview derives live: Goals, active Stages, Milestones, Decisions, Risks.
 */
export const PROJECT_UPDATE_SNAPSHOT_BLOCKS = [
  "Goals",
  "Stages",
  "Milestones",
  "Decisions",
  "Risks",
] as const;
export const projectUpdateSnapshotBlockNameSchema = z.enum(
  PROJECT_UPDATE_SNAPSHOT_BLOCKS,
);

export const PROJECT_UPDATE_NARRATIVE_MAX = 1000;
export const PROJECT_UPDATE_LINKS_MAX = 20;
const SNAPSHOT_RECORDS_MAX = 100;

const identifier = z.string().trim().min(1).max(255);
const optionalText = (max: number) => z.string().max(max).nullable();

export const projectUpdateSnapshotRecordSchema = z
  .object({
    id: identifier,
    status: optionalText(255),
    targetDate: optionalText(32),
    title: z.string().max(255),
  })
  .strict();

export const projectUpdateSnapshotBlockSchema = z
  .object({
    name: projectUpdateSnapshotBlockNameSchema,
    records: z
      .array(projectUpdateSnapshotRecordSchema)
      .max(SNAPSHOT_RECORDS_MAX),
  })
  .strict();

/** Historical, read-only copy of the summary blocks at the moment of saving. */
export const projectUpdateSnapshotSchema = z
  .object({
    blocks: z
      .array(projectUpdateSnapshotBlockSchema)
      .max(PROJECT_UPDATE_SNAPSHOT_BLOCKS.length)
      .refine(
        (blocks) =>
          new Set(blocks.map((block) => block.name)).size === blocks.length,
        "Each summary block appears once.",
      ),
    lifecycle: z.string().max(64),
    purpose: optionalText(4000),
    targetDate: optionalText(32),
  })
  .strict();
export type ProjectUpdateSnapshot = z.infer<typeof projectUpdateSnapshotSchema>;

export const projectUpdateLinkInputSchema = z
  .object({ targetId: identifier, targetType: projectUpdateLinkTypeSchema })
  .strict();
export type ProjectUpdateLinkInput = z.infer<
  typeof projectUpdateLinkInputSchema
>;

export const projectUpdatesInputSchema = z
  .object({ projectId: identifier })
  .strict();

/**
 * One create is one append. `updateId` is the client's id for this attempt, so
 * retrying the same save is replayed instead of adding a second entry.
 */
export const createProjectUpdateInputSchema = z
  .object({
    links: z
      .array(projectUpdateLinkInputSchema)
      .max(PROJECT_UPDATE_LINKS_MAX)
      .refine(
        (links) =>
          new Set(links.map((link) => `${link.targetType}:${link.targetId}`))
            .size === links.length,
        "Each record is linked once.",
      ),
    mark: projectUpdateMarkSchema,
    narrative: z.string().trim().min(1).max(PROJECT_UPDATE_NARRATIVE_MAX),
    projectId: identifier,
    snapshot: projectUpdateSnapshotSchema,
    updateId: identifier,
  })
  .strict();
export type CreateProjectUpdateInput = z.infer<
  typeof createProjectUpdateInputSchema
>;

/** A linked record as it is now; archived, trashed or gone records stay listed without content. */
export interface ProjectUpdateLink {
  label: string | null;
  /** The record's own status, read live; `null` while unavailable. */
  status: string | null;
  targetId: string;
  targetType: ProjectUpdateLinkType;
  unavailable: boolean;
}

export interface ProjectUpdate {
  id: string;
  links: ProjectUpdateLink[];
  mark: ProjectUpdateMark;
  narrative: string;
  projectId: string;
  /** When the founder saved this entry; also the moment the snapshot froze. */
  savedAt: string;
  snapshot: ProjectUpdateSnapshot;
}

export interface ProjectUpdatesOverview {
  /** An archived Project keeps its updates readable and takes no new one. */
  readOnly: boolean;
  /** Newest first; nothing is dropped, and nothing is reduced to one current row. */
  updates: ProjectUpdate[];
}

export class ProjectUpdateConflictError extends Error {
  readonly code = "PROJECT_UPDATE_CONFLICT" as const;

  constructor(updateId: string) {
    super(
      `Project Update ${updateId} is already saved with different content.`,
    );
    this.name = "ProjectUpdateConflictError";
  }
}

export class ProjectUpdateReadOnlyError extends Error {
  readonly code = "PROJECT_UPDATE_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and takes no new Project Update.`);
    this.name = "ProjectUpdateReadOnlyError";
  }
}

export class ProjectUpdateLinkError extends Error {
  readonly code = "PROJECT_UPDATE_LINK_INVALID" as const;

  constructor(link: ProjectUpdateLinkInput) {
    super(
      `${link.targetType} ${link.targetId} is not a live record of this Project.`,
    );
    this.name = "ProjectUpdateLinkError";
  }
}

export interface ProjectUpdatesAccess {
  /** Appends one entry; `null` when the Project is not the account's. */
  create: (
    accountId: string,
    input: CreateProjectUpdateInput,
  ) => Promise<ProjectUpdate | null>;
  /** The chronology, or `null` when the Project is not the account's. */
  overview: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectUpdatesOverview | null>;
}
