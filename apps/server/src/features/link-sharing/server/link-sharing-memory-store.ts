import type {
  ApprovedShare,
  ShareManifest,
  ShareRoot,
  ShareRootSummary,
} from "@cantiara/api/link-sharing";
import type {
  LinkSharingStore,
  ShareSource,
  StoredShareSurface,
} from "./link-sharing";

interface MemorySurface extends StoredShareSurface {
  accountId: string;
  root: ShareRoot;
}

const keyOf = (root: ShareRoot) => `${root.kind}:${root.id}`;

/**
 * In-memory Link Sharing store for the seam tests. One account owns every
 * source; another account sees nothing. Revisions are append-only.
 */
export function createMemoryLinkSharing(options: {
  accountId: string;
  sources: { root: ShareRoot; source: ShareSource }[];
}) {
  const sources = new Map(
    options.sources.map((entry) => [keyOf(entry.root), entry.source]),
  );
  const surfaces: MemorySurface[] = [];
  const revisions: {
    approvalId: string;
    fingerprint: string;
    manifest: ShareManifest;
    placeholdersAcknowledged: boolean;
    result: ApprovedShare;
    surfaceId: string;
  }[] = [];

  const store: LinkSharingStore = {
    commit(commit) {
      if (commit.accountId !== options.accountId) {
        return Promise.resolve(null);
      }
      let surface = commit.surfaceId
        ? surfaces.find((entry) => entry.surfaceId === commit.surfaceId)
        : undefined;
      if (commit.surfaceId && !surface) {
        return Promise.resolve(null);
      }
      const revision = surface ? surface.revision + 1 : 1;
      if (surface) {
        surface.manifest = commit.manifest;
        surface.revision = revision;
        surface.approvedAt = commit.manifest.approvedAt;
      } else {
        surface = {
          accountId: commit.accountId,
          approvedAt: commit.manifest.approvedAt,
          manifest: commit.manifest,
          revision,
          root: commit.root,
          surfaceId: commit.newSurfaceId,
        };
        surfaces.push(surface);
      }
      const result: ApprovedShare = {
        label: commit.manifest.label,
        lastApprovedAt: commit.manifest.approvedAt,
        revision,
        surfaceId: surface.surfaceId,
      };
      revisions.push({
        approvalId: commit.approvalId,
        fingerprint: commit.fingerprint,
        manifest: commit.manifest,
        placeholdersAcknowledged: commit.placeholdersAcknowledged,
        result,
        surfaceId: surface.surfaceId,
      });
      return Promise.resolve(result);
    },
    findApproval(accountId, approvalId) {
      const found = revisions.find((entry) => entry.approvalId === approvalId);
      const surface = surfaces.find(
        (entry) => entry.surfaceId === found?.surfaceId,
      );
      return Promise.resolve(
        found && surface?.accountId === accountId
          ? { fingerprint: found.fingerprint, result: found.result }
          : null,
      );
    },
    roots(accountId, projectId) {
      if (accountId !== options.accountId) {
        return Promise.resolve(null);
      }
      const owned = [...sources.values()].filter(
        (source) => source.projectId === projectId,
      );
      return Promise.resolve(
        owned.length === 0
          ? null
          : owned.map(
              (source): ShareRootSummary => ({
                id: source.record.id,
                kind: source.record.kind as ShareRootSummary["kind"],
                title: source.record.title,
              }),
            ),
      );
    },
    source(accountId, root) {
      return Promise.resolve(
        accountId === options.accountId
          ? (sources.get(keyOf(root)) ?? null)
          : null,
      );
    },
    surface(accountId, root, surfaceId) {
      const found = surfaces
        .filter(
          (entry) =>
            entry.accountId === accountId &&
            keyOf(entry.root) === keyOf(root) &&
            (!surfaceId || entry.surfaceId === surfaceId),
        )
        .at(-1);
      return Promise.resolve(found ?? null);
    },
  };

  return {
    revisions,
    setSource(root: ShareRoot, source: ShareSource) {
      sources.set(keyOf(root), source);
    },
    store,
    surfaces,
  };
}
