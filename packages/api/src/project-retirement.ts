import { z } from "zod";

/**
 * Project Retirement (spec 83, glossary `Proje arşivi`, `Arşiv güvenlik
 * istisnası`): the founder moves a Project into the `Archive` view. The
 * life-cycle status (`Active`, `Pending`, `Completed`, `Abandoned`) is not
 * rewritten; the Project becomes read-only and motionless. Archive is neither
 * the Trash (77) nor a hide filter. Unarchive never re-enables the GitHub
 * link; the canonical `Reconnect` (spec 61) stays the way back.
 */

export const ARCHIVE_LABEL = "Archive";
export const ARCHIVE_PROJECT_LABEL = "Archive Project";
export const UNARCHIVE_LABEL = "Unarchive";
export const PROJECT_ARCHIVED_BANNER =
  "This Project is archived and read-only.";
export const PROJECT_ARCHIVED_READ_ONLY_MESSAGE =
  "Archived Projects are read-only.";
export const ARCHIVE_GITHUB_NOTICE =
  "Unarchive does not re-enable GitHub. Use Reconnect in the Project's GitHub area.";

/** The normal working surfaces an archived Project leaves; shown in the preview. */
export const ARCHIVE_LEAVES_SURFACES = [
  "Work",
  "Documents",
  "Planning",
  "Roadmap",
  "Backlog",
] as const;

/**
 * The only actions an archived Project still accepts: each one reduces
 * access or removes a secret. Everything else, named or not, is refused.
 */
export const ARCHIVE_SECURITY_ACTIONS = [
  "surface-revoke",
  "token-rotation",
  "password-rotation",
  "session-end",
  "integration-disconnect",
  "integration-secret-rotation",
  "security-redaction",
] as const;
export type ArchiveSecurityAction = (typeof ARCHIVE_SECURITY_ACTIONS)[number];

/** Named refusals; the list is documentation, the allow-list is the rule. */
export const ARCHIVE_REFUSED_ACTIONS = [
  "publish",
  "reactivate",
  "password-removal",
  "content-edit",
  "access-widening",
] as const;
export type ArchiveRefusedAction = (typeof ARCHIVE_REFUSED_ACTIONS)[number];

/** What stops while archived and fails closed: not a security action. */
export const ARCHIVE_STOPPED_ACTIVITIES = [
  "normal-write",
  "github-sync",
  "automation",
  "reminder",
] as const;
export type ArchiveStoppedActivity =
  (typeof ARCHIVE_STOPPED_ACTIVITIES)[number];

export const ARCHIVE_SECURITY_ACTION_LABELS: Record<
  ArchiveSecurityAction,
  string
> = {
  "integration-disconnect": "Disconnect integration",
  "integration-secret-rotation": "Rotate integration secret",
  "password-rotation": "Rotate link password",
  "security-redaction": "Redact",
  "session-end": "End visitor sessions",
  "surface-revoke": "Revoke / Unpublish",
  "token-rotation": "Rotate link token",
};

const ALLOWED = new Set<string>(ARCHIVE_SECURITY_ACTIONS);

export type ArchivedActionDecision =
  | { allowed: true; reason: "not-archived" | "access-reducing" }
  | { allowed: false; reason: "archived-read-only" };

/**
 * The Arşiv güvenlik istisnası: a pure allow-list. An unarchived Project
 * leaves the decision to the normal rules; an archived one passes only an
 * access-reducing action. An unknown action is refused (fail closed).
 */
export function evaluateArchivedProjectAction(
  project: { archivedAt: string | Date | null },
  action: string,
): ArchivedActionDecision {
  if (!project.archivedAt) {
    return { allowed: true, reason: "not-archived" };
  }
  return ALLOWED.has(action)
    ? { allowed: true, reason: "access-reducing" }
    : { allowed: false, reason: "archived-read-only" };
}

export class ProjectRetirementError extends Error {
  readonly code: ProjectRetirementErrorCode;

  constructor(code: ProjectRetirementErrorCode, options?: { cause?: unknown }) {
    super(PROJECT_RETIREMENT_ERROR_MESSAGES[code], options);
    this.name = "ProjectRetirementError";
    this.code = code;
  }
}

export const PROJECT_RETIREMENT_ERROR_CODES = [
  "project_not_found",
  "already_archived",
  "not_archived",
  "project_archived",
  "empty_delete_group",
  "project_in_trash",
  "not_in_trash",
] as const;
export type ProjectRetirementErrorCode =
  (typeof PROJECT_RETIREMENT_ERROR_CODES)[number];

export const PROJECT_RETIREMENT_ERROR_MESSAGES: Record<
  ProjectRetirementErrorCode,
  string
> = {
  already_archived: "The Project is already archived.",
  empty_delete_group: "The Project has no record to move to Trash.",
  not_archived: "The Project is not archived.",
  not_in_trash: "The Project is not in Trash.",
  project_archived: PROJECT_ARCHIVED_READ_ONLY_MESSAGE,
  project_in_trash: "The Project is in Trash. Restore it to Archive first.",
  project_not_found: "Project is unavailable.",
};

/**
 * Fail-closed write guard for a shared seam: throws when the Project is
 * archived and the action is not an access-reducing one.
 */
export function assertArchivedProjectAllows(
  project: { archivedAt: string | Date | null },
  action: string,
): void {
  if (!evaluateArchivedProjectAction(project, action).allowed) {
    throw new ProjectRetirementError("project_archived");
  }
}

const identifier = z.string().trim().min(1).max(255);

export const previewArchiveProjectInputSchema = z
  .object({ projectId: identifier })
  .strict();
export type PreviewArchiveProjectInput = z.infer<
  typeof previewArchiveProjectInputSchema
>;

const transitionShape = {
  baseRevision: z.number().int().nonnegative().safe(),
  clientIdempotencyKey: z.string().trim().min(1).max(255),
  projectId: identifier,
};

/** Archive: the shared revision barrier takes the `baseRevision` of the preview. */
export const archiveProjectInputSchema = z.object(transitionShape).strict();
export type ArchiveProjectInput = z.infer<typeof archiveProjectInputSchema>;

export const unarchiveProjectInputSchema = z.object(transitionShape).strict();
export type UnarchiveProjectInput = z.infer<typeof unarchiveProjectInputSchema>;

export const listArchivedProjectsInputSchema = z.object({}).strict();

export const PROJECT_LIFECYCLE_STATUSES = [
  "Active",
  "Pending",
  "Completed",
  "Abandoned",
] as const;

export const retirementProjectSchema = z.object({
  archivedAt: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  revision: z.number().int().nonnegative(),
  shortCode: z.string(),
  /** The life-cycle status; archive never rewrites it. */
  status: z.enum(PROJECT_LIFECYCLE_STATUSES),
});
export type RetirementProject = z.infer<typeof retirementProjectSchema>;

export const IN_FLIGHT_KINDS = [
  "Import",
  "Upload",
  "Automation",
  "GitHub sync",
] as const;
export type InFlightKind = (typeof IN_FLIGHT_KINDS)[number];

/** One piece of in-flight work with its exact state, never a guess. */
export const inFlightWorkSchema = z.object({
  kind: z.enum(IN_FLIGHT_KINDS),
  state: z.string(),
});
export type InFlightWork = z.infer<typeof inFlightWorkSchema>;

export const archivedSurfaceSchema = z.object({
  sourceKind: z.string(),
  /** How the source stands now; the approved snapshot is what the surface serves. */
  sourceState: z.enum([
    "Unchanged since approval",
    "Changed since approval",
    "Source detached",
  ]),
  status: z.literal("Active"),
  surfaceId: z.string(),
  title: z.string(),
  visibility: z.enum(["Link", "Wiki", "Build in Public"]),
});
export type ArchivedSurface = z.infer<typeof archivedSurfaceSchema>;

export const archiveSecurityActionItemSchema = z.object({
  action: z.enum(ARCHIVE_SECURITY_ACTIONS),
  label: z.string(),
  source: z.object({
    id: z.string(),
    kind: z.string(),
    state: z.string(),
    title: z.string(),
  }),
});
export type ArchiveSecurityActionItem = z.infer<
  typeof archiveSecurityActionItemSchema
>;

export const archivePreviewSchema = z.object({
  /** The whole allow-list, so the founder sees what stays open before archiving. */
  allowedActions: z.array(
    z.object({ action: z.enum(ARCHIVE_SECURITY_ACTIONS), label: z.string() }),
  ),
  githubNotice: z.string(),
  inFlight: z.array(inFlightWorkSchema),
  /** The normal working surfaces the Project leaves. */
  leaves: z.array(z.string()),
  project: retirementProjectSchema,
  /** Previously approved External Surfaces that may keep living. */
  surfaces: z.array(archivedSurfaceSchema),
  /** The access-reducing actions that stay open. */
  securityActions: z.array(archiveSecurityActionItemSchema),
  stops: z.array(z.string()),
});
export type ArchivePreview = z.infer<typeof archivePreviewSchema>;

export const RESTORE_TO_ARCHIVE_LABEL = "Restore to Archive";
export const RESTORE_TO_ARCHIVE_RESULT =
  "Restoring returns the Project to Archive. No surface is republished and GitHub stays disconnected.";
export const REPUBLISH_APPROVAL_NOTICE =
  "Republishing requires a new approval.";
export const PROJECT_IN_TRASH_MARK = "In Trash";

/**
 * A Project whose delete group waits in Trash. The Project row itself stays
 * archived (it is not a Trash kind), so the Archive view marks it instead.
 */
export const projectTrashSchema = z.object({
  /** The group entry a restore names; its revision is the restore base revision. */
  baseRevision: z.number().int().nonnegative(),
  entryId: z.string(),
  expiresAt: z.string(),
  groupId: z.string(),
  mark: z.literal(PROJECT_IN_TRASH_MARK),
  trashedAt: z.string(),
});
export type ProjectTrash = z.infer<typeof projectTrashSchema>;

export const archivedProjectEntrySchema = z.object({
  githubNotice: z.string(),
  project: retirementProjectSchema,
  /** `null` while the Project is in the Archive proper. */
  trash: projectTrashSchema.nullable(),
  securityActions: z.array(archiveSecurityActionItemSchema),
  surfaces: z.array(archivedSurfaceSchema),
});
export type ArchivedProjectEntry = z.infer<typeof archivedProjectEntrySchema>;

export const archiveViewSchema = z.object({
  projects: z.array(archivedProjectEntrySchema),
});
export type ArchiveView = z.infer<typeof archiveViewSchema>;

export const DELETE_PROJECT_LABEL = "Delete Project";
export const DELETE_PROJECT_CONFIRM_LABEL = "Move to Trash";
export const DELETE_RESTORE_NOTICE =
  "Restore returns the group to the Archive. It does not republish any External Surface or re-enable GitHub; publishing again needs a new External Surface, URL or token and an explicit approval.";
export const DELETE_RETAINED_NOTICE =
  "Workspace, Account and Personal Wiki records are not deleted.";
export const DELETE_TRASH_NOTICE =
  "The whole group enters Trash as one unit on one 30-day clock.";
export const DELETED_TARGET_MARK = "In Trash";

export const previewDeleteProjectInputSchema = z
  .object({ projectId: identifier })
  .strict();
export type PreviewDeleteProjectInput = z.infer<
  typeof previewDeleteProjectInputSchema
>;

/** Strict: a `surfaceDisposition` (`Keep approved surface`) is refused, not ignored. */
export const deleteProjectInputSchema = z.object(transitionShape).strict();
export type DeleteProjectInput = z.infer<typeof deleteProjectInputSchema>;

/** One member of the Proje silme grubu, as the preview names it. */
export const deleteGroupMemberSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  label: z.string(),
  recordId: z.string(),
  recordKind: z.string(),
});
export type DeleteGroupMember = z.infer<typeof deleteGroupMemberSchema>;

/** A living relation in another scope whose target goes to Trash with the group. */
export const livingRelationSchema = z.object({
  mark: z.literal(DELETED_TARGET_MARK),
  scope: z.string(),
  sourceLabel: z.string(),
  targetLabel: z.string(),
});
export type LivingRelation = z.infer<typeof livingRelationSchema>;

/**
 * `Restore to Archive`: the group entry (from the Archive view) and its Trash
 * revision. Strict, so no surface or GitHub choice can ride along.
 */
export const restoreProjectToArchiveInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(255),
    entryId: identifier,
    projectId: identifier,
  })
  .strict();
export type RestoreProjectToArchiveInput = z.infer<
  typeof restoreProjectToArchiveInputSchema
>;

export const restoredProjectSchema = z.object({
  githubNotice: z.string(),
  groupId: z.string().nullable(),
  notices: z.array(z.string()),
  projectId: z.string(),
  /** The same identities that went to Trash, never copies. */
  records: z.array(
    z.object({
      recordId: z.string(),
      recordKind: z.string(),
      revision: z.number().int().nonnegative(),
    }),
  ),
  restoredAt: z.string(),
});
export type RestoredProject = z.infer<typeof restoredProjectSchema>;

export const deleteProjectPreviewSchema = z.object({
  group: z.array(deleteGroupMemberSchema),
  integrationsStop: z.array(
    z.object({ id: z.string(), label: z.string(), state: z.string() }),
  ),
  /** `Keep approved surface` is never offered on this preview. */
  keepApprovedSurface: z.object({ available: z.literal(false) }),
  notices: z.array(z.string()),
  project: retirementProjectSchema,
  relations: z.array(livingRelationSchema),
  /** Active surfaces revoked terminally, immediately. */
  revokedSurfaces: z.array(archivedSurfaceSchema),
  visitorSessionsEnd: z.boolean(),
});
export type DeleteProjectPreview = z.infer<typeof deleteProjectPreviewSchema>;

export const deletedProjectSchema = z.object({
  expiresAt: z.string(),
  groupId: z.string().nullable(),
  projectId: z.string(),
  records: z.number().int().nonnegative(),
  revokedSurfaceIds: z.array(z.string()),
  trashedAt: z.string(),
});
export type DeletedProject = z.infer<typeof deletedProjectSchema>;

export interface ProjectRetirementAccess {
  /** Moves the Project to read-only through the shared revision barrier; the status stays. */
  archive: (
    accountId: string,
    input: ArchiveProjectInput,
  ) => Promise<RetirementProject>;
  /**
   * `Delete Project` (Archive only): terminal-revokes the Project's External
   * Surfaces and visitor sessions, then hands the whole delete group to Trash
   * as one 30-day unit. Never keeps a surface.
   */
  deleteProject: (
    accountId: string,
    input: DeleteProjectInput,
  ) => Promise<DeletedProject>;
  /** The `Archive` view: archived Projects, living surfaces and open security actions. */
  list: (accountId: string) => Promise<ArchiveView>;
  /** Read-only: writes nothing. */
  preview: (
    accountId: string,
    input: PreviewArchiveProjectInput,
  ) => Promise<ArchivePreview>;
  /** Read-only delete preview; refused unless the Project is archived. */
  previewDelete: (
    accountId: string,
    input: PreviewDeleteProjectInput,
  ) => Promise<DeleteProjectPreview>;
  /**
   * `Restore to Archive`: the whole delete group returns under the same
   * identities and the Project stays archived. Surfaces and GitHub are never
   * touched: a revoked surface stays revoked, nothing is republished.
   */
  restoreToArchive: (
    accountId: string,
    input: RestoreProjectToArchiveInput,
  ) => Promise<RestoredProject>;
  /** Leaves the Archive. GitHub stays paused until the canonical `Reconnect`. */
  unarchive: (
    accountId: string,
    input: UnarchiveProjectInput,
  ) => Promise<RetirementProject>;
}
