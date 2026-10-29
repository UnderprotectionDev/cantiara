import type {
  ApprovedShare,
  ShareManifest,
  ShareRoot,
  ShareRootSummary,
} from "@cantiara/api/link-sharing";
import type {
  LinkSharingSecurityEvents,
  LinkSharingStore,
  ShareAccessEvent,
  ShareSource,
  StoredShareSurface,
} from "./link-sharing";
import type {
  LinkSharingVisitorStore,
  StoredVisitorSession,
} from "./link-sharing-visitor";
import { ATTEMPT_RETENTION_MS } from "./link-sharing-visitor";

interface MemorySurface extends StoredShareSurface {
  accessEpoch: number;
  accountId: string;
  cancelledAt: Date | null;
  passwordHash: string | null;
  root: ShareRoot;
  tokenHash: string | null;
}

interface MemoryAttempt {
  failures: number;
  lastAttemptAt: Date;
  lockedUntil: Date | null;
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
  const sessions: StoredVisitorSession[] = [];
  const attempts = new Map<string, MemoryAttempt>();
  const events: ShareAccessEvent[] = [];
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
          accessEpoch: 0,
          accountId: commit.accountId,
          approvedAt: commit.manifest.approvedAt,
          cancelledAt: null,
          manifest: commit.manifest,
          passwordHash: null,
          passwordProtected: false,
          revision,
          root: commit.root,
          surfaceId: commit.newSurfaceId,
          tokenHash: commit.tokenHash,
        };
        surfaces.push(surface);
      }
      const result: ApprovedShare = {
        accessToken: null,
        label: commit.manifest.label,
        lastApprovedAt: commit.manifest.approvedAt,
        passwordProtected: surface.passwordProtected,
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
    updateAccess(accountId, surfaceId, patch) {
      const surface = surfaces.find(
        (entry) =>
          entry.surfaceId === surfaceId &&
          entry.accountId === accountId &&
          entry.cancelledAt === null,
      );
      if (!surface) {
        return Promise.resolve(null);
      }
      if (patch.passwordHash !== undefined) {
        surface.passwordHash = patch.passwordHash;
        surface.passwordProtected = patch.passwordHash !== null;
      }
      if (patch.tokenHash !== undefined) {
        surface.tokenHash = patch.tokenHash;
      }
      surface.accessEpoch += 1;
      return Promise.resolve({
        accessEpoch: surface.accessEpoch,
        passwordProtected: surface.passwordProtected,
      });
    },
  };

  const securityEvents: LinkSharingSecurityEvents = {
    append(event) {
      events.push(event);
      return Promise.resolve();
    },
  };

  const visitorStore: LinkSharingVisitorStore = {
    bumpFailure(key, now) {
      const current = attempts.get(key);
      const fresh =
        !current ||
        now.getTime() - current.lastAttemptAt.getTime() > ATTEMPT_RETENTION_MS;
      const next: MemoryAttempt = {
        failures: fresh ? 1 : current.failures + 1,
        lastAttemptAt: now,
        lockedUntil: fresh ? null : current.lockedUntil,
      };
      attempts.set(key, next);
      return Promise.resolve(next.failures);
    },
    clearFailures(keys) {
      for (const key of keys) {
        attempts.delete(key);
      }
      return Promise.resolve();
    },
    createSession(session) {
      sessions.push(session);
      return Promise.resolve();
    },
    findSession(id) {
      return Promise.resolve(sessions.find((entry) => entry.id === id) ?? null);
    },
    lockedUntil(keys, now) {
      const ends = keys
        .map((key) => attempts.get(key)?.lockedUntil)
        .filter((end): end is Date => !!end && end > now);
      return Promise.resolve(
        ends.length === 0
          ? null
          : new Date(Math.max(...ends.map((end) => end.getTime()))),
      );
    },
    lockUntil(key, until) {
      const current = attempts.get(key);
      if (current) {
        current.lockedUntil = until;
      }
      return Promise.resolve();
    },
    purge(now) {
      for (const [key, attempt] of attempts) {
        if (
          now.getTime() - attempt.lastAttemptAt.getTime() >
          ATTEMPT_RETENTION_MS
        ) {
          attempts.delete(key);
        }
      }
      for (let index = sessions.length - 1; index >= 0; index -= 1) {
        if ((sessions[index]?.expiresAt ?? now) <= now) {
          sessions.splice(index, 1);
        }
      }
      return Promise.resolve();
    },
    snapshot(surfaceId) {
      const surface = surfaces.find((entry) => entry.surfaceId === surfaceId);
      return Promise.resolve(
        surface
          ? {
              approvedAt: surface.approvedAt,
              label: surface.manifest.label,
              manifest: surface.manifest,
              revision: surface.revision,
            }
          : null,
      );
    },
    surface(surfaceId) {
      const surface = surfaces.find((entry) => entry.surfaceId === surfaceId);
      return Promise.resolve(
        surface
          ? {
              accessEpoch: surface.accessEpoch,
              cancelledAt: surface.cancelledAt,
              passwordHash: surface.passwordHash,
              surfaceId: surface.surfaceId,
            }
          : null,
      );
    },
    surfaceByTokenHash(tokenHash) {
      const surface = surfaces.find((entry) => entry.tokenHash === tokenHash);
      return Promise.resolve(
        surface
          ? {
              accessEpoch: surface.accessEpoch,
              cancelledAt: surface.cancelledAt,
              passwordHash: surface.passwordHash,
              surfaceId: surface.surfaceId,
            }
          : null,
      );
    },
  };

  return {
    attempts,
    events,
    revisions,
    securityEvents,
    sessions,
    setSource(root: ShareRoot, source: ShareSource) {
      sources.set(keyOf(root), source);
    },
    store,
    surfaces,
    visitorStore,
  };
}
