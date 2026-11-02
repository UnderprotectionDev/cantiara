import type { SurfaceRow } from "@cantiara/api/external-surface-management";
import {
  ARCHIVE_GITHUB_NOTICE,
  ARCHIVE_LEAVES_SURFACES,
  ARCHIVE_SECURITY_ACTION_LABELS,
  ARCHIVE_SECURITY_ACTIONS,
  ARCHIVE_STOPPED_ACTIVITIES,
  type ArchivedSurface,
  type ArchivePreview,
  type ArchiveProjectInput,
  type ArchiveSecurityActionItem,
  type ArchiveView,
  archiveProjectInputSchema,
  DELETE_RESTORE_NOTICE,
  DELETE_RETAINED_NOTICE,
  DELETE_TRASH_NOTICE,
  type DeletedProject,
  type DeleteGroupMember,
  type DeleteProjectInput,
  type DeleteProjectPreview,
  deleteProjectInputSchema,
  type InFlightWork,
  type LivingRelation,
  PROJECT_IN_TRASH_MARK,
  type PreviewArchiveProjectInput,
  type PreviewDeleteProjectInput,
  type ProjectRetirementAccess,
  ProjectRetirementError,
  type ProjectTrash,
  previewArchiveProjectInputSchema,
  previewDeleteProjectInputSchema,
  REPUBLISH_APPROVAL_NOTICE,
  RESTORE_TO_ARCHIVE_RESULT,
  type RestoredProject,
  type RestoreProjectToArchiveInput,
  type RetirementProject,
  restoreProjectToArchiveInputSchema,
  type UnarchiveProjectInput,
  unarchiveProjectInputSchema,
} from "@cantiara/api/project-retirement";
import type { TrashAccess, TrashRecordKind } from "@cantiara/api/trash";

/** A GitHub link as the archive sees it: the connection state, nothing else. */
export interface RetirementIntegration {
  id: string;
  label: string;
  state: string;
}

export interface RetirementTransition {
  archived: boolean;
  baseRevision: number;
  clientIdempotencyKey: string;
  projectId: string;
}

/**
 * Persistence port. `transition` is the one write: it goes through the shared
 * Mutation Contract revision barrier (stale base revision conflicts, a repeat
 * of the same key replays) and writes only the archive column. It never
 * touches the life-cycle status, the Trash columns or a hide filter.
 */
export interface ProjectRetirementStore {
  find: (
    accountId: string,
    projectId: string,
  ) => Promise<RetirementProject | null>;
  listArchived: (accountId: string) => Promise<RetirementProject[]>;
  transition: (
    accountId: string,
    input: RetirementTransition,
  ) => Promise<RetirementProject | null>;
}

/**
 * The Proje silme grubu as the Project knows it: the canonical main records,
 * owned components and External Surfaces (never Workspace, Account or Personal
 * Wiki records), the living relations from other scopes, and the terminal
 * revoke of one External Surface (which also ends its visitor sessions).
 */
export interface RetirementDeleteGroupPort {
  /** Members that are not yet in Trash, read after the surfaces are revoked. */
  members: (
    accountId: string,
    projectId: string,
  ) => Promise<DeleteGroupMember[]>;
  /** Living relations in other scopes that point into the group. */
  relations: (
    accountId: string,
    projectId: string,
  ) => Promise<LivingRelation[]>;
  /** Terminal revoke through the shared External Surface path; idempotent. */
  revokeSurface: (accountId: string, surfaceId: string) => Promise<unknown>;
}

export interface ProjectRetirementPorts {
  deleteGroup: RetirementDeleteGroupPort;
  /** Exact state of in-flight import, upload, automation and sync work. */
  inFlight: (accountId: string, projectId: string) => Promise<InFlightWork[]>;
  /** GitHub links of the Project; the archive only reads and never re-enables them. */
  integrations: (
    accountId: string,
    projectId: string,
  ) => Promise<RetirementIntegration[]>;
  store: ProjectRetirementStore;
  /** The Project's External Surface rows (spec 76); `null` when not the account's. */
  surfaces: (
    accountId: string,
    projectId: string,
  ) => Promise<SurfaceRow[] | null>;
  /**
   * The 77 Trash clock: the group move, the overview that tells whether the
   * group waits in Trash, and the group restore. No surface or GitHub port
   * exists next to it, so a restore cannot republish or reconnect.
   */
  trash: Pick<TrashAccess, "moveGroup" | "overview" | "restore">;
}

function livingSurface(row: SurfaceRow): ArchivedSurface {
  let sourceState: ArchivedSurface["sourceState"] = "Unchanged since approval";
  if (row.frozenDetached) {
    sourceState = "Source detached";
  } else if (row.hasUnpublishedChanges) {
    sourceState = "Changed since approval";
  }
  return {
    sourceKind: row.source.kind,
    sourceState,
    status: "Active",
    surfaceId: row.surfaceId,
    title: row.source.title || row.source.kind,
    visibility: row.visibility,
  };
}

function surfaceActions(
  row: SurfaceRow,
  surface: ArchivedSurface,
): ArchiveSecurityActionItem[] {
  const source = {
    id: surface.surfaceId,
    kind: `${surface.visibility} surface`,
    state: surface.sourceState,
    title: surface.title,
  };
  const actions: ArchiveSecurityActionItem["action"][] = ["surface-revoke"];
  if (row.visibility === "Link") {
    actions.push("token-rotation", "session-end");
    if (row.passwordProtected) {
      actions.push("password-rotation");
    }
  }
  return actions.map((action) => ({
    action,
    label: ARCHIVE_SECURITY_ACTION_LABELS[action],
    source,
  }));
}

function integrationActions(
  integrations: RetirementIntegration[],
): ArchiveSecurityActionItem[] {
  return integrations.map((integration) => ({
    action: "integration-disconnect",
    label: ARCHIVE_SECURITY_ACTION_LABELS["integration-disconnect"],
    source: {
      id: integration.id,
      kind: "GitHub repository link",
      state: integration.state,
      title: integration.label,
    },
  }));
}

export function createProjectRetirement(
  ports: ProjectRetirementPorts,
): ProjectRetirementAccess {
  const { store } = ports;

  async function living(accountId: string, project: RetirementProject) {
    const [rows, integrations] = await Promise.all([
      ports.surfaces(accountId, project.id),
      ports.integrations(accountId, project.id),
    ]);
    const active = (rows ?? []).filter((row) => row.status === "Active");
    const surfaces = active.map(livingSurface);
    const securityActions = [
      ...active.flatMap((row, index) =>
        surfaceActions(row, surfaces[index] as ArchivedSurface),
      ),
      ...integrationActions(integrations),
    ];
    return { securityActions, surfaces };
  }

  async function transition(
    accountId: string,
    raw: ArchiveProjectInput | UnarchiveProjectInput,
    archived: boolean,
  ) {
    const input = (
      archived ? archiveProjectInputSchema : unarchiveProjectInputSchema
    ).parse(raw);
    const current = await store.find(accountId, input.projectId);
    if (!current) {
      throw new ProjectRetirementError("project_not_found");
    }
    if (archived && current.archivedAt) {
      throw new ProjectRetirementError("already_archived");
    }
    if (!(archived || current.archivedAt)) {
      throw new ProjectRetirementError("not_archived");
    }
    if (!archived) {
      await notInTrash(accountId, input.projectId);
    }
    const next = await store.transition(accountId, { ...input, archived });
    if (!next) {
      throw new ProjectRetirementError("project_not_found");
    }
    return next;
  }

  /** The Project's delete group in Trash, if any; one deterministic entry names it. */
  async function projectTrash(
    accountId: string,
    projectId: string,
  ): Promise<ProjectTrash | null> {
    const overview = await ports.trash.overview(accountId, projectId);
    const [entry] = (overview?.entries ?? [])
      .filter((candidate) => candidate.groupId !== null)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!entry?.groupId) {
      return null;
    }
    return {
      baseRevision: entry.revision,
      entryId: entry.id,
      expiresAt: entry.expiresAt,
      groupId: entry.groupId,
      mark: PROJECT_IN_TRASH_MARK,
      trashedAt: entry.trashedAt,
    };
  }

  async function notInTrash(accountId: string, projectId: string) {
    if (await projectTrash(accountId, projectId)) {
      throw new ProjectRetirementError("project_in_trash");
    }
  }

  async function archivedProject(accountId: string, projectId: string) {
    const current = await store.find(accountId, projectId);
    if (!current) {
      throw new ProjectRetirementError("project_not_found");
    }
    if (!current.archivedAt) {
      throw new ProjectRetirementError("not_archived");
    }
    return current;
  }

  return {
    archive: (accountId, input) => transition(accountId, input, true),

    async deleteProject(
      accountId,
      raw: DeleteProjectInput,
    ): Promise<DeletedProject> {
      const input = deleteProjectInputSchema.parse(raw);
      const current = await archivedProject(accountId, input.projectId);
      await notInTrash(accountId, input.projectId);
      if (current.revision !== input.baseRevision) {
        throw Object.assign(new Error("stale"), {
          code: "STALE_BASE_REVISION",
          currentRevision: current.revision,
        });
      }
      // Terminal and access-reducing, so it comes first: an External Surface
      // can enter Trash only once revoked, and a retry finds them revoked.
      const rows = (await ports.surfaces(accountId, input.projectId)) ?? [];
      const active = rows.filter((row) => row.status === "Active");
      await Promise.all(
        active.map((row) =>
          ports.deleteGroup.revokeSurface(accountId, row.surfaceId),
        ),
      );
      const members = await ports.deleteGroup.members(
        accountId,
        input.projectId,
      );
      if (members.length === 0) {
        throw new ProjectRetirementError("empty_delete_group");
      }
      const entries = await ports.trash.moveGroup(accountId, {
        clientIdempotencyKey: input.clientIdempotencyKey,
        members: members.map((member) => ({
          baseRevision: member.baseRevision,
          recordId: member.recordId,
          recordKind: member.recordKind as TrashRecordKind,
        })),
        projectId: input.projectId,
      });
      const [first] = entries ?? [];
      if (!(entries && first)) {
        throw new ProjectRetirementError("project_not_found");
      }
      return {
        expiresAt: first.expiresAt,
        groupId: first.groupId,
        projectId: input.projectId,
        records: entries.length,
        revokedSurfaceIds: active.map((row) => row.surfaceId),
        trashedAt: first.trashedAt,
      };
    },

    async previewDelete(
      accountId,
      raw: PreviewDeleteProjectInput,
    ): Promise<DeleteProjectPreview> {
      const input = previewDeleteProjectInputSchema.parse(raw);
      const project = await archivedProject(accountId, input.projectId);
      await notInTrash(accountId, input.projectId);
      const [rows, integrations, group, relations] = await Promise.all([
        ports.surfaces(accountId, project.id),
        ports.integrations(accountId, project.id),
        ports.deleteGroup.members(accountId, project.id),
        ports.deleteGroup.relations(accountId, project.id),
      ]);
      const revokedSurfaces = (rows ?? [])
        .filter((row) => row.status === "Active")
        .map(livingSurface);
      return {
        group,
        integrationsStop: integrations,
        keepApprovedSurface: { available: false },
        notices: [
          DELETE_TRASH_NOTICE,
          DELETE_RETAINED_NOTICE,
          DELETE_RESTORE_NOTICE,
        ],
        project,
        relations,
        revokedSurfaces,
        visitorSessionsEnd: revokedSurfaces.some(
          (surface) => surface.visibility === "Link",
        ),
      };
    },

    async list(accountId): Promise<ArchiveView> {
      const archived = await store.listArchived(accountId);
      const projects = await Promise.all(
        archived.map(async (project) => ({
          githubNotice: ARCHIVE_GITHUB_NOTICE,
          project,
          trash: await projectTrash(accountId, project.id),
          ...(await living(accountId, project)),
        })),
      );
      return { projects };
    },

    async preview(
      accountId,
      raw: PreviewArchiveProjectInput,
    ): Promise<ArchivePreview> {
      const input = previewArchiveProjectInputSchema.parse(raw);
      const project = await store.find(accountId, input.projectId);
      if (!project) {
        throw new ProjectRetirementError("project_not_found");
      }
      if (project.archivedAt) {
        throw new ProjectRetirementError("already_archived");
      }
      const [inFlight, keep] = await Promise.all([
        ports.inFlight(accountId, project.id),
        living(accountId, project),
      ]);
      return {
        allowedActions: ARCHIVE_SECURITY_ACTIONS.map((action) => ({
          action,
          label: ARCHIVE_SECURITY_ACTION_LABELS[action],
        })),
        githubNotice: ARCHIVE_GITHUB_NOTICE,
        inFlight,
        leaves: [...ARCHIVE_LEAVES_SURFACES],
        project,
        stops: [...ARCHIVE_STOPPED_ACTIVITIES],
        ...keep,
      };
    },

    async restoreToArchive(
      accountId,
      raw: RestoreProjectToArchiveInput,
    ): Promise<RestoredProject> {
      const input = restoreProjectToArchiveInputSchema.parse(raw);
      const current = await store.find(accountId, input.projectId);
      if (!current) {
        throw new ProjectRetirementError("project_not_found");
      }
      // A repeat of a finished restore finds no entry any more and replays
      // through Trash's receipt; an entry that is no group member is no Project.
      const overview = await ports.trash.overview(accountId, input.projectId);
      const entry = overview?.entries.find(
        (candidate) => candidate.id === input.entryId,
      );
      if (entry && entry.groupId === null) {
        throw new ProjectRetirementError("not_in_trash");
      }
      const result = await ports.trash.restore(accountId, {
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        entryId: input.entryId,
        projectId: input.projectId,
      });
      if (!result) {
        throw new ProjectRetirementError("not_in_trash");
      }
      return {
        githubNotice: ARCHIVE_GITHUB_NOTICE,
        groupId: result.groupId,
        notices: [RESTORE_TO_ARCHIVE_RESULT, REPUBLISH_APPROVAL_NOTICE],
        projectId: result.projectId,
        records: result.records,
        restoredAt: result.restoredAt,
      };
    },

    unarchive: (accountId, input) => transition(accountId, input, false),
  };
}
