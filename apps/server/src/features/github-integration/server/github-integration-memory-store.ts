// biome-ignore-all lint/performance/noAwaitInLoops: Each Project's installation effect is applied in its own rollback scope.
import type {
  GitHubExternalRecord,
  GitHubIntegrationStore,
  GitHubIntegrationTransaction,
  GitHubStoredCredential,
  GitHubStoredInstallation,
  GitHubStoredLink,
} from "@cantiara/api/github-integration";

import { createGitHubAppDouble, type DoubleClock } from "./github-app-double";
import { createGitHubAppGateway } from "./github-app-gateway";
import {
  createGitHubSecrets,
  parseGitHubKeyRing,
} from "./github-credential-envelope";
import { createGitHubIntegration } from "./github-integration";

export const accountId = "account-1";
export const otherAccountId = "account-2";
export const projectId = "project-1";
export const archivedProjectId = "project-archived";
export const otherProjectId = "project-2";

interface MemoryState {
  credentials: Map<string, GitHubStoredCredential>;
  history: Map<string, { name: string; observedAt: string; owner: string }[]>;
  installations: GitHubStoredInstallation[];
  links: GitHubStoredLink[];
  records: (GitHubExternalRecord & { id: string })[];
}

const OWNERS: Record<string, string> = {
  [archivedProjectId]: accountId,
  [otherProjectId]: otherAccountId,
  [projectId]: accountId,
};

function emptyState(): MemoryState {
  return {
    credentials: new Map(),
    history: new Map(),
    installations: [],
    links: [],
    records: [],
  };
}

/** Rolls the state back when a unit of work throws, like a database transaction. */
function createMemoryStore(state: {
  current: MemoryState;
}): GitHubIntegrationStore {
  const transactionFor = (
    scopeProjectId: string,
    readOnly: boolean,
  ): GitHubIntegrationTransaction => {
    const inProject = <T extends { projectId: string }>(rows: T[]) =>
      rows.filter((row) => row.projectId === scopeProjectId);
    return {
      claimsOfInstallation: (installationId) =>
        Promise.resolve(
          state.current.installations
            .filter((row) => row.installationId === installationId)
            .map(({ connectedByAccountId, projectId: owner }) => ({
              connectedByAccountId,
              projectId: owner,
            })),
        ),
      installationByGitHubId: (installationId) =>
        Promise.resolve(
          inProject(state.current.installations).find(
            (row) => row.installationId === installationId,
          ) ?? null,
        ),
      insertInstallation: (row) => {
        state.current.installations.push({ ...row });
        return Promise.resolve();
      },
      insertLink: (row) => {
        state.current.links.push({ ...row });
        return Promise.resolve();
      },
      installations: () =>
        Promise.resolve(
          inProject(state.current.installations).map((row) => ({ ...row })),
        ),
      linkById: (id) =>
        Promise.resolve(
          inProject(state.current.links).find((row) => row.id === id) ?? null,
        ),
      linkByRepositoryId: (repositoryId) =>
        Promise.resolve(
          inProject(state.current.links).find(
            (row) => row.repositoryId === repositoryId,
          ) ?? null,
        ),
      links: () =>
        Promise.resolve(
          inProject(state.current.links).map((row) => ({ ...row })),
        ),
      loadCredential: (installationRowId) =>
        Promise.resolve(
          state.current.credentials.get(installationRowId) ?? null,
        ),
      nameHistory: (linkId) =>
        Promise.resolve([...(state.current.history.get(linkId) ?? [])]),
      readOnly,
      recordNameHistory: (linkId, entry) => {
        state.current.history.set(linkId, [
          ...(state.current.history.get(linkId) ?? []),
          entry,
        ]);
        return Promise.resolve();
      },
      records: (linkId) =>
        Promise.resolve(
          inProject(state.current.records).filter(
            (row) => linkId === undefined || row.linkId === linkId,
          ),
        ),
      saveCredential: (installationRowId, credential) => {
        state.current.credentials.set(installationRowId, credential);
        return Promise.resolve();
      },
      updateInstallation: (id, patch) => {
        const row = state.current.installations.find((item) => item.id === id);
        if (row) {
          Object.assign(row, patch);
        }
        return Promise.resolve();
      },
      updateLink: (id, patch) => {
        const row = state.current.links.find((item) => item.id === id);
        if (row) {
          Object.assign(row, patch);
        }
        return Promise.resolve();
      },
      upsertExternalRecords: (writes) => {
        for (const { id, linkId, projectId: owner, snapshot } of writes) {
          const existing = state.current.records.find(
            (row) =>
              row.linkId === linkId &&
              row.kind === snapshot.kind &&
              row.githubId === snapshot.githubId,
          );
          if (existing && existing.sourceUpdatedAt > snapshot.sourceUpdatedAt) {
            continue;
          }
          const next = {
            ...snapshot,
            id: existing?.id ?? id,
            linkId,
            projectId: owner,
          };
          if (existing) {
            Object.assign(existing, next);
          } else {
            state.current.records.push(next);
          }
        }
        return Promise.resolve();
      },
    };
  };

  const rollbackOnFailure = async <T>(work: () => Promise<T>) => {
    const before = structuredClone(state.current);
    try {
      return await work();
    } catch (error) {
      state.current = before;
      throw error;
    }
  };

  return {
    run: (account, scopeProjectId, _mode, work) => {
      if (OWNERS[scopeProjectId] !== account) {
        return Promise.resolve(null);
      }
      return rollbackOnFailure(() =>
        work(
          transactionFor(scopeProjectId, scopeProjectId === archivedProjectId),
        ),
      );
    },
    runForInstallation: async (installationId, work) => {
      const projectIds = [
        ...new Set(
          state.current.installations
            .filter((row) => row.installationId === installationId)
            .map((row) => row.projectId),
        ),
      ];
      for (const scope of projectIds) {
        await rollbackOnFailure(() =>
          work(transactionFor(scope, false), scope),
        );
      }
    },
  };
}

/**
 * Account Access fixture. Login identity and product sessions belong to spec 01;
 * GitHub Integration never reads or writes them, which the seam tests assert by
 * revoking the login and uninstalling the App independently.
 */
export function createAccountAccessFixture() {
  const identities = new Set<string>([accountId, otherAccountId]);
  const sessions = new Set<string>([accountId, otherAccountId]);
  return {
    hasLoginIdentity: (account: string) => identities.has(account),
    hasSession: (account: string) => sessions.has(account),
    revokeLoginIdentity: (account: string) => identities.delete(account),
  };
}

export function createMemoryHarness(options: { configured?: boolean } = {}) {
  const clock: DoubleClock = { current: new Date("2026-10-01T09:00:00.000Z") };
  const app = createGitHubAppDouble(clock);
  const state = { current: emptyState() };
  const secrets = createGitHubSecrets(
    parseGitHubKeyRing(
      `1:${Buffer.alloc(32, 1).toString("base64")},2:${Buffer.alloc(32, 2).toString("base64")}`,
      1,
    ),
  );
  const gateway =
    options.configured === false
      ? null
      : createGitHubAppGateway({
          appSlug: "cantiara-test",
          transport: app.transport,
        });
  const github = createGitHubIntegration({
    gateway,
    now: () => clock.current,
    secrets,
    store: createMemoryStore(state),
  });
  return {
    account: createAccountAccessFixture(),
    app,
    clock,
    github,
    secrets,
    /** Raw stored rows, for asserting what persists and what never does. */
    stored: () => state.current,
  };
}
