// biome-ignore-all lint/performance/noAwaitInLoops: Each Project's installation effect is applied in its own rollback scope.
import { createHmac } from "node:crypto";
import type {
  GitHubStoredCheck,
  GitHubStoredPullHead,
} from "@cantiara/api/github-checks";
import type {
  GitHubIntegrationStore,
  GitHubIntegrationTransaction,
  GitHubLinkHistoryEntry,
  GitHubRecordWriteOutcome,
  GitHubStoredCredential,
  GitHubStoredInstallation,
  GitHubStoredLink,
  GitHubStoredRecord,
} from "@cantiara/api/github-integration";
import type { GitHubPrContextWorkFacts } from "@cantiara/api/github-pr-context";
import type {
  GitHubStoredSignal,
  GitHubStoredSuggestion,
  GitHubStoredWorkLink,
  GitHubWorkRef,
} from "@cantiara/api/github-work-links";

import { createGitHubAppDouble, type DoubleClock } from "./github-app-double";
import { createGitHubAppGateway } from "./github-app-gateway";
import {
  createGitHubSecrets,
  parseGitHubKeyRing,
} from "./github-credential-envelope";
import { createGitHubIntegration } from "./github-integration";
import { decideRecordWrite } from "./github-record-ordering";
import {
  createGitHubWebhookInbox,
  type OperatorAlarm,
} from "./github-webhook-inbox";
import { createMemoryInboxStore } from "./github-webhook-inbox-memory-store";

export const accountId = "account-1";
export const otherAccountId = "account-2";
export const projectId = "project-1";
export const archivedProjectId = "project-archived";
export const otherProjectId = "project-2";
export const WEBHOOK_SECRET = "whsec_test_secret_0123456789";

interface MemoryTombstone {
  deletedAt: string;
  githubId: number;
  kind: GitHubStoredRecord["kind"];
  linkId: string;
  number: number;
  recordId: string;
}

type MemoryWork = GitHubWorkRef & { description: string; projectId: string };

interface MemoryState {
  archivedProjects: Set<string>;
  archivedRecords: Set<string>;
  checks: GitHubStoredCheck[];
  contextFacts: GitHubPrContextWorkFacts[];
  credentials: Map<string, GitHubStoredCredential>;
  history: Map<string, { name: string; observedAt: string; owner: string }[]>;
  installations: GitHubStoredInstallation[];
  linkHistory: Map<string, GitHubLinkHistoryEntry[]>;
  links: GitHubStoredLink[];
  pullHeads: GitHubStoredPullHead[];
  records: GitHubStoredRecord[];
  signals: GitHubStoredSignal[];
  suggestions: GitHubStoredSuggestion[];
  tombstones: MemoryTombstone[];
  trashedRecords: Set<string>;
  workLinks: GitHubStoredWorkLink[];
  works: MemoryWork[];
}

/** Short code each fixture Project owns: the Work key prefix. */
const SHORT_CODES: Record<string, string> = {
  [archivedProjectId]: "ARC",
  [otherProjectId]: "OTH",
  [projectId]: "CAN",
};

const OWNERS: Record<string, string> = {
  [archivedProjectId]: accountId,
  [otherProjectId]: otherAccountId,
  [projectId]: accountId,
};

function emptyState(): MemoryState {
  return {
    archivedProjects: new Set([archivedProjectId]),
    archivedRecords: new Set(),
    checks: [],
    contextFacts: [],
    pullHeads: [],
    trashedRecords: new Set(),
    credentials: new Map(),
    history: new Map(),
    installations: [],
    linkHistory: new Map(),
    links: [],
    records: [],
    signals: [],
    suggestions: [],
    tombstones: [],
    workLinks: [],
    works: [],
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
      // The in-memory harness runs one initializeOperation at a time, so the
      // claim lock is already serialized.
      lockInstallationClaim: () => Promise.resolve(),
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
      appendHistory: (linkId, entry) => {
        state.current.linkHistory.set(linkId, [
          ...(state.current.linkHistory.get(linkId) ?? []),
          entry,
        ]);
        return Promise.resolve();
      },
      deleteCredential: (installationRowId) => {
        state.current.credentials.delete(installationRowId);
        return Promise.resolve();
      },
      deleteRecordWithTombstone: (recordId, at) => {
        const record = state.current.records.find((row) => row.id === recordId);
        if (record) {
          state.current.tombstones.push({
            deletedAt: at,
            githubId: record.githubId,
            kind: record.kind,
            linkId: record.linkId,
            number: record.number,
            recordId: record.id,
          });
          state.current.records = state.current.records.filter(
            (row) => row.id !== recordId,
          );
          // The links, suggestions and signals of the record go with it.
          const { current } = state;
          current.workLinks = current.workLinks.filter(
            (row) => row.recordId !== recordId,
          );
          current.suggestions = current.suggestions.filter(
            (row) => row.recordId !== recordId,
          );
          current.signals = current.signals.filter(
            (row) => row.recordId !== recordId,
          );
          current.checks = current.checks.filter(
            (row) => row.recordId !== recordId,
          );
          current.pullHeads = current.pullHeads.filter(
            (row) => row.recordId !== recordId,
          );
        }
        return Promise.resolve();
      },
      checks: () =>
        Promise.resolve(
          inProject(state.current.checks).map((row) => ({ ...row })),
        ),
      prContextFacts: (workIds) =>
        Promise.resolve(
          state.current.contextFacts
            .filter((fact) => workIds.includes(fact.workId))
            .map((fact) => structuredClone(fact)),
        ),
      pruneSupersededChecks: (recordId, headSha) => {
        state.current.checks = state.current.checks.filter(
          (row) => row.recordId !== recordId || row.headSha === headSha,
        );
        return Promise.resolve();
      },
      pullHeads: () =>
        Promise.resolve(
          inProject(state.current.pullHeads).map((row) => ({ ...row })),
        ),
      setPullHead: (head) => {
        state.current.pullHeads = [
          ...state.current.pullHeads.filter(
            (row) => row.recordId !== head.recordId,
          ),
          { ...head },
        ];
        return Promise.resolve();
      },
      upsertChecks: (rows) => {
        for (const row of rows) {
          const existing = state.current.checks.find(
            (item) =>
              item.recordId === row.recordId &&
              item.headSha === row.headSha &&
              item.provider === row.provider &&
              item.checkId === row.checkId,
          );
          state.current.checks = [
            ...state.current.checks.filter(
              (item) =>
                !(
                  item.recordId === row.recordId &&
                  item.headSha === row.headSha &&
                  item.provider === row.provider &&
                  item.checkId === row.checkId
                ),
            ),
            {
              ...row,
              // Mirrors the PostgreSQL rule: a REST read without a
              // requiredness never erases GitHub's own "required" statement.
              requirement:
                row.requirement === "Unknown" && existing
                  ? existing.requirement
                  : row.requirement,
            },
          ];
        }
        return Promise.resolve();
      },
      createWork: (input) => {
        const count = inProject(state.current.works).length + 1;
        const work: MemoryWork = {
          closureResult: null,
          description: input.description,
          id: `work-${scopeProjectId}-${count}`,
          key: `${SHORT_CODES[scopeProjectId]}-${count}`,
          previousKeys: [],
          projectId: scopeProjectId,
          retiredIds: [],
          status: "Not Started",
          title: input.title,
          trashed: false,
        };
        state.current.works.push(work);
        return Promise.resolve({ ...work });
      },
      deleteWorkLink: (id) => {
        state.current.workLinks = state.current.workLinks.filter(
          (row) => row.id !== id,
        );
        return Promise.resolve();
      },
      history: (linkId) =>
        Promise.resolve([...(state.current.linkHistory.get(linkId) ?? [])]),
      insertSignal: (signal) => {
        if (
          !state.current.signals.some((row) => row.signalId === signal.signalId)
        ) {
          state.current.signals.push({ ...signal });
        }
        return Promise.resolve();
      },
      insertWorkLink: (row) => {
        state.current.workLinks.push({ ...row });
        return Promise.resolve();
      },
      keyScope: () =>
        Promise.resolve({
          otherShortCodes: Object.entries(SHORT_CODES)
            .filter(([id]) => id !== scopeProjectId)
            .map(([, code]) => code),
          ownShortCodes: [SHORT_CODES[scopeProjectId] ?? ""],
          works: inProject(state.current.works).map((work) => ({ ...work })),
        }),
      ownerAccountId: () => Promise.resolve(OWNERS[scopeProjectId] ?? ""),
      replaceSuggestions: (recordId, suggestions) => {
        state.current.suggestions = [
          ...state.current.suggestions.filter(
            (row) => row.recordId !== recordId,
          ),
          ...suggestions,
        ];
        return Promise.resolve();
      },
      signals: () =>
        Promise.resolve(
          inProject(state.current.signals).map((row) => ({ ...row })),
        ),
      suggestions: () =>
        Promise.resolve(
          inProject(state.current.suggestions).map((row) => ({ ...row })),
        ),
      updateSignal: (signalId, patch) => {
        const row = state.current.signals.find(
          (item) => item.signalId === signalId,
        );
        if (row) {
          Object.assign(row, patch);
        }
        return Promise.resolve();
      },
      updateWorkLink: (id, patch) => {
        const row = state.current.workLinks.find((item) => item.id === id);
        if (row) {
          Object.assign(row, patch);
        }
        return Promise.resolve();
      },
      workLinks: () =>
        Promise.resolve(
          inProject(state.current.workLinks).map((row) => ({ ...row })),
        ),
      recordById: (recordId) =>
        Promise.resolve(
          inProject(state.current.records).find((row) => row.id === recordId) ??
            null,
        ),
      recordByNumber: (linkId, kind, number) =>
        Promise.resolve(
          inProject(state.current.records).find(
            (row) =>
              row.linkId === linkId &&
              row.kind === kind &&
              row.number === number,
          ) ?? null,
        ),
      recordsByIds: (ids) =>
        Promise.resolve(
          inProject(state.current.records).filter((row) =>
            ids.includes(row.id),
          ),
        ),
      countRecords: (linkId) =>
        Promise.resolve(
          inProject(state.current.records).filter(
            (row) => row.linkId === linkId,
          ).length,
        ),
      searchActiveRecords: (needle, limit) => {
        const matches = (record: GitHubStoredRecord) =>
          needle === "" ||
          [
            record.title,
            record.milestone ?? "",
            String(record.number),
            ...record.labels,
          ].some((value) => value.toLowerCase().includes(needle));
        return Promise.resolve(
          inProject(state.current.records)
            .filter(
              (record) => record.lifecycle === "Active" && matches(record),
            )
            .sort((a, b) => b.sourceUpdatedAt.localeCompare(a.sourceUpdatedAt))
            .slice(0, limit),
        );
      },
      records: (linkId) =>
        Promise.resolve(
          inProject(state.current.records).filter(
            (row) => linkId === undefined || row.linkId === linkId,
          ),
        ),
      reincludeRecord: (write) => {
        state.current.tombstones = state.current.tombstones.filter(
          (row) =>
            !(
              row.linkId === write.linkId &&
              row.kind === write.snapshot.kind &&
              row.githubId === write.snapshot.githubId
            ),
        );
        const record: GitHubStoredRecord = {
          ...write.snapshot,
          appliedFrom: "reconcile",
          id: write.id,
          lifecycle: "Active",
          linkId: write.linkId,
          needsReconcile: false,
          origin: write.origin ?? null,
          projectId: write.projectId,
        };
        state.current.records.push(record);
        return Promise.resolve({ ...record });
      },
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Mirrors the PostgreSQL ordering decision for the in-memory harness.
      setRecordLifecycle: (recordId, patch) => {
        const row = state.current.records.find((item) => item.id === recordId);
        if (row) {
          if (patch.needsReconcile !== undefined) {
            row.needsReconcile = patch.needsReconcile;
          }
          const { archivedRecords, trashedRecords } = state.current;
          if (patch.archivedAt !== undefined) {
            if (patch.archivedAt) {
              archivedRecords.add(recordId);
            } else {
              archivedRecords.delete(recordId);
            }
          }
          if (patch.trashedAt !== undefined) {
            if (patch.trashedAt) {
              trashedRecords.add(recordId);
            } else {
              trashedRecords.delete(recordId);
            }
          }
          if (trashedRecords.has(recordId)) {
            row.lifecycle = "Trash";
          } else {
            row.lifecycle = archivedRecords.has(recordId)
              ? "Archived"
              : "Active";
          }
        }
        return Promise.resolve();
      },
      tombstone: (linkId, kind, githubId) => {
        const found = state.current.tombstones.find(
          (row) =>
            row.linkId === linkId &&
            row.kind === kind &&
            row.githubId === githubId,
        );
        return Promise.resolve(
          found
            ? {
                deletedAt: found.deletedAt,
                number: found.number,
                recordId: found.recordId,
              }
            : null,
        );
      },
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
      upsertExternalRecords: (writes, options) => {
        const outcomes: GitHubRecordWriteOutcome[] = [];
        for (const { id, linkId, projectId: owner, snapshot } of writes) {
          const existing =
            state.current.records.find(
              (row) =>
                row.linkId === linkId &&
                row.kind === snapshot.kind &&
                row.githubId === snapshot.githubId,
            ) ?? null;
          const tombstoned = state.current.tombstones.some(
            (row) =>
              row.linkId === linkId &&
              row.kind === snapshot.kind &&
              row.githubId === snapshot.githubId,
          );
          const decision = decideRecordWrite({
            existing,
            options,
            snapshot,
            tombstoned,
          });
          const outcome: GitHubRecordWriteOutcome = {
            conflict: decision.conflict,
            githubId: snapshot.githubId,
            kind: snapshot.kind,
            recordId: existing?.id ?? null,
            replaced: null,
            result: decision.result,
          };
          if (decision.action === "insert") {
            state.current.records.push({
              ...snapshot,
              appliedFrom: options.origin,
              id,
              lifecycle: "Active",
              linkId,
              needsReconcile: false,
              origin: null,
              projectId: owner,
            });
            outcome.recordId = id;
          } else if (decision.action === "update" && existing) {
            if (existing.needsReconcile) {
              outcome.replaced = {
                sourceState: existing.sourceState,
                title: existing.title,
              };
            }
            Object.assign(existing, snapshot, {
              appliedFrom: options.origin,
              needsReconcile: false,
            });
          }
          outcomes.push(outcome);
        }
        return Promise.resolve(outcomes);
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
    linkScopes: () =>
      Promise.resolve(
        state.current.links.map(({ id, projectId: owner }) => ({
          linkId: id,
          projectId: owner,
        })),
      ),
    run: (account, scopeProjectId, _mode, work) => {
      if (OWNERS[scopeProjectId] !== account) {
        return Promise.resolve(null);
      }
      return rollbackOnFailure(() =>
        work(
          transactionFor(
            scopeProjectId,
            state.current.archivedProjects.has(scopeProjectId),
          ),
        ),
      );
    },
    runForProject: (scopeProjectId, work) => {
      if (!(scopeProjectId in OWNERS)) {
        return Promise.resolve(null);
      }
      return rollbackOnFailure(() =>
        work(
          transactionFor(
            scopeProjectId,
            state.current.archivedProjects.has(scopeProjectId),
          ),
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
          work(
            transactionFor(scope, state.current.archivedProjects.has(scope)),
            scope,
          ),
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
  const inboxMemory = createMemoryInboxStore();
  const alarms: OperatorAlarm[] = [];
  const enqueued: string[] = [];
  const inbox = createGitHubWebhookInbox({
    alarm: (alarm) => alarms.push(alarm),
    bootstrapSecret: WEBHOOK_SECRET,
    enqueue: (deliveryId) => {
      enqueued.push(deliveryId);
      return Promise.resolve();
    },
    integration: github,
    now: () => clock.current,
    secrets,
    store: inboxMemory.store,
  });
  return {
    account: createAccountAccessFixture(),
    alarms,
    app,
    archiveProject: (id: string) => state.current.archivedProjects.add(id),
    enqueued,
    inbox,
    inboxRows: inboxMemory,
    /** `sha256=<hex>` of the exact raw body, as GitHub signs it. */
    sign: (body: string, secret = WEBHOOK_SECRET) =>
      `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
    unarchiveProject: (id: string) => state.current.archivedProjects.delete(id),
    /** The Work owner as a fixture: seeding and changing Work is not this seam's write. */
    work: {
      add(
        project: string,
        work: Partial<MemoryWork> & { key: string; title: string },
      ) {
        const row: MemoryWork = {
          closureResult: null,
          description: "",
          id: `work-${work.key}`,
          previousKeys: [],
          projectId: project,
          retiredIds: [],
          status: "Not Started",
          trashed: false,
          ...work,
        };
        state.current.works.push(row);
        return row;
      },
      complete(workId: string) {
        const row = state.current.works.find((item) => item.id === workId);
        if (row) {
          row.status = "Closed";
          row.closureResult = "Completed";
        }
      },
      trash(workId: string) {
        const row = state.current.works.find((item) => item.id === workId);
        if (row) {
          row.trashed = true;
        }
      },
      /** The owner records (text, Karar, Risk, Feedback, Release) a Work relates to. */
      setContext(
        workId: string,
        facts: Partial<Omit<GitHubPrContextWorkFacts, "workId">>,
      ) {
        state.current.contextFacts = [
          ...state.current.contextFacts.filter(
            (item) => item.workId !== workId,
          ),
          {
            expectedOutcome: null,
            problemOpportunity: null,
            records: [],
            ...facts,
            workId,
          },
        ];
      },
      /** A deep copy of every Work row, to assert a link never changed one. */
      snapshot: () => structuredClone(state.current.works),
    },
    clock,
    github,
    secrets,
    /** Raw stored rows, for asserting what persists and what never does. */
    stored: () => state.current,
  };
}
