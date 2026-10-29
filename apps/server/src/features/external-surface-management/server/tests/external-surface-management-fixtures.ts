import type {
  SurfaceDirectoryStore,
  SurfaceRecord,
} from "../external-surface-management";

export const ACCOUNT = "account-1";
export const PROJECT = "project-1";

const at = (iso: string) => new Date(iso);

export function surface(patch: Partial<SurfaceRecord> = {}): SurfaceRecord {
  return {
    cancelledAt: null,
    documentId: null,
    expiresAt: null,
    passwordProtected: false,
    projectId: PROJECT,
    projectName: "Cantiara",
    revision: {
      createdAt: at("2026-01-02T00:00:00Z"),
      number: 1,
      snapshot: {
        approvedAt: "2026-01-02T00:00:00Z",
        root: { id: "d1", kind: "Document", title: "Plan" },
      },
    },
    rootId: "d1",
    rootKind: "Document",
    surfaceId: "s-link",
    surfaceKind: "Link-limited share",
    wikiDocumentRevision: null,
    ...patch,
  };
}

export function wikiSurface(patch: Partial<SurfaceRecord> = {}) {
  return surface({
    documentId: "wiki-1",
    projectId: null,
    projectName: null,
    revision: {
      createdAt: at("2026-01-03T00:00:00Z"),
      number: 2,
      snapshot: {
        approvedAt: "2026-01-03T00:00:00Z",
        documentRevision: 4,
        kind: "Wiki Document",
        title: "Notes",
      },
    },
    rootId: null,
    rootKind: null,
    surfaceId: "s-wiki",
    surfaceKind: null,
    wikiDocumentRevision: 4,
    ...patch,
  });
}

export function buildInPublicSurface(patch: Partial<SurfaceRecord> = {}) {
  return surface({
    revision: {
      createdAt: at("2026-01-01T00:00:00Z"),
      number: 3,
      snapshot: { approvedAt: "2026-01-01T00:00:00Z", kind: "Build in Public" },
    },
    rootId: null,
    rootKind: null,
    surfaceId: "s-bip",
    surfaceKind: null,
    ...patch,
  });
}

/** Another account's surfaces never appear; `scoped` limits a Project query. */
export function memoryDirectory(
  records: SurfaceRecord[],
  owner = ACCOUNT,
): SurfaceDirectoryStore {
  return {
    records: (accountId, scope) => {
      if (accountId !== owner) {
        return Promise.resolve([]);
      }
      return Promise.resolve(
        scope.projectId
          ? records.filter((record) => record.projectId === scope.projectId)
          : records,
      );
    },
  };
}
