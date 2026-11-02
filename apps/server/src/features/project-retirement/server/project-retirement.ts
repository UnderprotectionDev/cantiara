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
  type InFlightWork,
  type PreviewArchiveProjectInput,
  type ProjectRetirementAccess,
  ProjectRetirementError,
  previewArchiveProjectInputSchema,
  type RetirementProject,
  type UnarchiveProjectInput,
  unarchiveProjectInputSchema,
} from "@cantiara/api/project-retirement";

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

export interface ProjectRetirementPorts {
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
    const next = await store.transition(accountId, { ...input, archived });
    if (!next) {
      throw new ProjectRetirementError("project_not_found");
    }
    return next;
  }

  return {
    archive: (accountId, input) => transition(accountId, input, true),

    async list(accountId): Promise<ArchiveView> {
      const archived = await store.listArchived(accountId);
      const projects = await Promise.all(
        archived.map(async (project) => ({
          githubNotice: ARCHIVE_GITHUB_NOTICE,
          project,
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

    unarchive: (accountId, input) => transition(accountId, input, false),
  };
}
