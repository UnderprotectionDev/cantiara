// biome-ignore-all lint/performance/noAwaitInLoops: Each record or signal is applied in order inside one unit of work.

import { failedChecksOnCurrentHead } from "@cantiara/api/github-checks";
import type {
  GitHubIntegrationStore,
  GitHubIntegrationTransaction,
  GitHubIssueSnapshot,
  GitHubStoredLink,
  GitHubStoredRecord,
} from "@cantiara/api/github-integration";
import {
  deriveAttentionSignals,
  GITHUB_ATTENTION_PRESENTATION,
  GITHUB_ROLE_CONTEXTUAL_LABEL,
  GITHUB_ROLE_REQUIRED_LABEL,
  type GitHubAttentionSignal,
  type GitHubCreateWorkPreview,
  type GitHubStoredSignal,
  type GitHubStoredSuggestion,
  type GitHubStoredWorkLink,
  type GitHubSuggestion,
  type GitHubWorkLink,
  type GitHubWorkLinkAccess,
  type GitHubWorkLinksOverview,
  type GitHubWorkRef,
  gitHubCreateWorkInputSchema,
  gitHubCreateWorkPreviewInputSchema,
  gitHubDismissSignalInputSchema,
  gitHubLinkWorkInputSchema,
  gitHubUnlinkWorkInputSchema,
  gitHubWorkLinksInputSchema,
  type gitHubWorkLinkTargetSchema,
  matchWorkKeys,
} from "@cantiara/api/github-work-links";
import type { z } from "zod";

class GitHubWorkLinkError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GitHubWorkLinkError";
  }
}

export class GitHubWorkNotFoundError extends GitHubWorkLinkError {
  constructor(workId: string) {
    super(
      "GITHUB_WORK_NOT_FOUND",
      `Work ${workId} was not found in this Project.`,
    );
  }
}

export class GitHubWorkLinkNotFoundError extends GitHubWorkLinkError {
  constructor(linkId: string) {
    super("GITHUB_WORK_LINK_NOT_FOUND", `Link ${linkId} was not found.`);
  }
}

export class GitHubWorkLinkExistsError extends GitHubWorkLinkError {
  constructor() {
    super(
      "GITHUB_WORK_LINK_EXISTS",
      "This Work already links this GitHub record.",
    );
  }
}

export class GitHubWorkLinkRoleError extends GitHubWorkLinkError {
  constructor() {
    super(
      "GITHUB_WORK_LINK_ROLE_INVALID",
      "Required for completion applies to a Pull request only.",
    );
  }
}

export class GitHubWorkLinkTargetError extends GitHubWorkLinkError {
  constructor(message: string) {
    super("GITHUB_WORK_LINK_TARGET_UNAVAILABLE", message);
  }
}

export class GitHubSignalNotFoundError extends GitHubWorkLinkError {
  constructor() {
    super("GITHUB_SIGNAL_NOT_FOUND", "The signal was not found.");
  }
}

interface ResolvedTarget {
  kind: GitHubStoredWorkLink["kind"];
  recordId: string | null;
  repositoryLinkId: string;
  targetKey: string;
  value: string | null;
}

type Scope = <T>(
  accountId: string,
  projectId: string,
  mode: "read" | "write",
  work: (transaction: GitHubIntegrationTransaction) => Promise<T>,
) => Promise<T>;

export interface GitHubWorkLinkDependencies {
  newId: () => string;
  now: () => Date;
  /** Exact commit through the allow-listed Git database endpoint; `null` when GitHub has none. */
  resolveCommit: (
    transaction: GitHubIntegrationTransaction,
    link: GitHubStoredLink,
    sha: string,
  ) => Promise<string | null>;
  scope: Scope;
  store: GitHubIntegrationStore;
}

function stripMatchText(snapshot: GitHubIssueSnapshot): GitHubIssueSnapshot {
  // The head SHA lives in the head table of the PR check summary, not on the record.
  const { headSha: _headSha, matchText: _matchText, ...stored } = snapshot;
  return stored;
}

/** The snapshots a store may persist: the transient key-match text is dropped first. */
export function storableSnapshot(snapshot: GitHubIssueSnapshot) {
  return stripMatchText(snapshot);
}

function workFor(works: GitHubWorkRef[], workId: string) {
  return (
    works.find(
      (work) => work.id === workId || work.retiredIds.includes(workId),
    ) ?? null
  );
}

function targetKeyOf(
  link: { id: string },
  kind: "Branch" | "Commit",
  value: string,
) {
  return `${link.id}:${kind}:${value}`;
}

function summaryOf(
  signal: Pick<GitHubStoredSignal, "signalType">,
  record: GitHubStoredRecord,
  work: GitHubWorkRef | null,
) {
  if (signal.signalType === "unlinked-open-pr") {
    return `Pull request #${record.number} is open and no Work links it.`;
  }
  if (signal.signalType === "failed-check") {
    return `A check failed on the current head of Pull request #${record.number}.`;
  }
  return `${work?.key ?? "A Work"} is Completed and Pull request #${record.number} is open.`;
}

/**
 * Recomputes the two registered signals from current state. The signal id is
 * derived from its sources, so a source pair opens at most one signal; a
 * dismissed signal stays dismissed while its condition holds, a condition that
 * ended closes the signal, and a condition that returns opens it again.
 */
export async function refreshAttentionSignals(
  transaction: GitHubIntegrationTransaction,
  now: Date,
) {
  const [
    records,
    links,
    repositoryLinks,
    scope,
    stored,
    pullHeads,
    storedChecks,
  ] = await Promise.all([
    transaction.records(),
    transaction.workLinks(),
    transaction.links(),
    transaction.keyScope(),
    transaction.signals(),
    transaction.pullHeads(),
    transaction.checks(),
  ]);
  const desired = deriveAttentionSignals({
    failedChecks: failedChecksOnCurrentHead(pullHeads, storedChecks),
    disconnectedLinkIds: new Set(
      repositoryLinks
        .filter((link) => link.disconnectedAt)
        .map((link) => link.id),
    ),
    links: links.filter((link) => !link.removedAt),
    records,
    works: scope.works,
  });
  const desiredIds = new Set(desired.map((signal) => signal.signalId));
  let ownerAccountId: string | null = null;
  for (const signal of desired) {
    const existing = stored.find((row) => row.signalId === signal.signalId);
    if (!existing) {
      ownerAccountId ??= await transaction.ownerAccountId();
      await transaction.insertSignal({
        closedAt: null,
        dismissedAt: null,
        occurredAt: now.toISOString(),
        ownerAccountId,
        projectId:
          records.find((record) => record.id === signal.recordId)?.projectId ??
          "",
        recordId: signal.recordId,
        signalId: signal.signalId,
        signalType: signal.signalType,
        workId: signal.workId,
      });
    } else if (existing.closedAt) {
      await transaction.updateSignal(signal.signalId, {
        closedAt: null,
        dismissedAt: null,
        occurredAt: now.toISOString(),
      });
    }
  }
  for (const existing of stored) {
    if (!(existing.closedAt || desiredIds.has(existing.signalId))) {
      await transaction.updateSignal(existing.signalId, {
        closedAt: now.toISOString(),
      });
    }
  }
}

/**
 * Key matching of the records one reconcile or webhook just applied. It only
 * ever writes this seam's own link and suggestion rows: never the GitHub
 * record and never a Work. A link the founder removed stays removed.
 */
export async function applyKeyMatches(
  transaction: GitHubIntegrationTransaction,
  entries: { recordId: string; snapshot: GitHubIssueSnapshot }[],
  deps: Pick<GitHubWorkLinkDependencies, "newId" | "now">,
) {
  if (entries.length === 0) {
    return;
  }
  const scope = await transaction.keyScope();
  const links = await transaction.workLinks();
  for (const { recordId, snapshot } of entries) {
    const record = await transaction.recordById(recordId);
    if (!record || record.lifecycle === "Trash") {
      continue;
    }
    const match = matchWorkKeys({
      kind: record.kind,
      scope,
      texts: [
        record.title,
        snapshot.matchText?.body,
        snapshot.matchText?.headBranch,
      ],
    });
    const suggestions: GitHubStoredSuggestion[] = match.suggestions.map(
      (suggestion) => ({
        closingIntent: suggestion.closingIntent,
        id: `${record.id}:${suggestion.key}`,
        key: suggestion.key,
        projectId: record.projectId,
        reason: suggestion.reason,
        recordId: record.id,
        workId: suggestion.workId,
      }),
    );
    await transaction.replaceSuggestions(record.id, suggestions);
    if (match.outcome !== "link") {
      continue;
    }
    const work = workFor(scope.works, match.workId);
    if (!work) {
      continue;
    }
    const existing = links.find(
      (link) =>
        link.recordId === record.id &&
        workFor(scope.works, link.workId)?.id === work.id,
    );
    if (!existing) {
      const row: GitHubStoredWorkLink = {
        createdAt: deps.now().toISOString(),
        createdByAccountId: null,
        id: deps.newId(),
        kind: record.kind,
        matchedKey: match.matchedKey,
        origin: "Key match",
        projectId: record.projectId,
        recordId: record.id,
        removedAt: null,
        repositoryLinkId: record.linkId,
        role: match.role,
        targetKey: record.id,
        value: null,
        workId: work.id,
      };
      await transaction.insertWorkLink(row);
      links.push(row);
    } else if (
      !existing.removedAt &&
      existing.origin === "Key match" &&
      existing.role !== match.role
    ) {
      await transaction.updateWorkLink(existing.id, { role: match.role });
      existing.role = match.role;
    }
  }
}

function displayOf(
  row: GitHubStoredWorkLink,
  record: GitHubStoredRecord | undefined,
  repository: GitHubStoredLink,
) {
  if (record) {
    return {
      htmlUrl: record.htmlUrl,
      label: `#${record.number} ${record.title}`,
    };
  }
  const value = row.value ?? "";
  return {
    htmlUrl:
      row.kind === "Commit"
        ? `${repository.htmlUrl}/commit/${value}`
        : `${repository.htmlUrl}/tree/${encodeURIComponent(value)}`,
    label: value,
  };
}

export function createGitHubWorkLinks(
  deps: GitHubWorkLinkDependencies,
): GitHubWorkLinkAccess {
  const { scope, newId, now } = deps;

  async function presentLinks(
    transaction: GitHubIntegrationTransaction,
    rows: GitHubStoredWorkLink[],
    works: GitHubWorkRef[],
  ): Promise<GitHubWorkLink[]> {
    const records = new Map(
      (await transaction.records()).map((record) => [record.id, record]),
    );
    const repositories = new Map(
      (await transaction.links()).map((link) => [link.id, link]),
    );
    const presented: GitHubWorkLink[] = [];
    for (const row of rows) {
      const work = workFor(works, row.workId);
      const record = row.recordId ? records.get(row.recordId) : undefined;
      const repository = repositories.get(row.repositoryLinkId);
      if (!(work && repository) || (row.recordId && !record)) {
        continue;
      }
      const repositoryName = `${repository.owner}/${repository.name}`;
      const { htmlUrl, label } = displayOf(row, record, repository);
      presented.push({
        createdAt: row.createdAt,
        htmlUrl,
        id: row.id,
        kind: row.kind,
        label,
        matchedKey: row.matchedKey,
        number: record?.number ?? null,
        origin: row.origin,
        projectId: row.projectId,
        recordId: row.recordId,
        repository: repositoryName,
        repositoryLinkId: row.repositoryLinkId,
        role: row.role,
        sourceState: record?.sourceState ?? null,
        value: row.value,
        workId: work.id,
        workKey: work.key,
        workTitle: work.title,
      });
    }
    return presented;
  }

  async function presentOne(
    transaction: GitHubIntegrationTransaction,
    linkId: string,
  ) {
    const scoped = await transaction.keyScope();
    const row = (await transaction.workLinks()).find(
      (candidate) => candidate.id === linkId,
    );
    const [presented] = row
      ? await presentLinks(transaction, [row], scoped.works)
      : [];
    if (!presented) {
      throw new GitHubWorkLinkNotFoundError(linkId);
    }
    return presented;
  }

  async function presentSignals(
    transaction: GitHubIntegrationTransaction,
    works: GitHubWorkRef[],
  ): Promise<GitHubAttentionSignal[]> {
    const records = new Map(
      (await transaction.records()).map((record) => [record.id, record]),
    );
    const signals: GitHubAttentionSignal[] = [];
    for (const signal of await transaction.signals()) {
      const record = records.get(signal.recordId);
      if (signal.closedAt || signal.dismissedAt || !record) {
        continue;
      }
      const work = signal.workId ? workFor(works, signal.workId) : null;
      signals.push({
        occurredAt: signal.occurredAt,
        presentation: GITHUB_ATTENTION_PRESENTATION,
        record: {
          htmlUrl: record.htmlUrl,
          id: record.id,
          kind: record.kind,
          number: record.number,
          sourceState: record.sourceState,
          title: record.title,
        },
        signalId: signal.signalId,
        signalType: signal.signalType,
        summary: summaryOf(signal, record, work),
        work: work ? { id: work.id, key: work.key, title: work.title } : null,
      });
    }
    return signals.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async function requireWork(
    transaction: GitHubIntegrationTransaction,
    workId: string,
  ) {
    const work = workFor((await transaction.keyScope()).works, workId);
    if (!work || work.trashed) {
      throw new GitHubWorkNotFoundError(workId);
    }
    return work;
  }

  async function requireRecord(
    transaction: GitHubIntegrationTransaction,
    recordId: string,
  ) {
    const record = await transaction.recordById(recordId);
    if (!record || record.lifecycle === "Trash") {
      throw new GitHubWorkLinkTargetError(
        "This GitHub record is not available to link.",
      );
    }
    return record;
  }

  /** The record, or the exact commit or branch of a linked Repository, a link may point at. */
  async function resolveTarget(
    tx: GitHubIntegrationTransaction,
    target: z.output<typeof gitHubWorkLinkTargetSchema>,
  ) {
    if (target.kind === "record") {
      const record = await requireRecord(tx, target.recordId);
      return {
        kind: record.kind,
        recordId: record.id,
        repositoryLinkId: record.linkId,
        targetKey: record.id,
        value: null,
      } satisfies ResolvedTarget;
    }
    const repository = await tx.linkById(target.linkId);
    if (!repository) {
      throw new GitHubWorkLinkTargetError(
        "This Repository is not linked to the Project.",
      );
    }
    let value = target.kind === "Branch" ? target.name : "";
    if (target.kind === "Commit") {
      const sha = await deps.resolveCommit(tx, repository, target.sha);
      if (!sha) {
        throw new GitHubWorkLinkTargetError(
          "GitHub does not show this commit in the Repository.",
        );
      }
      value = sha.toLowerCase();
    }
    return {
      kind: target.kind,
      recordId: null,
      repositoryLinkId: repository.id,
      targetKey: targetKeyOf(repository, target.kind, value),
      value,
    } satisfies ResolvedTarget;
  }

  return {
    async attentionSignals(accountId, rawInput) {
      const input = gitHubWorkLinksInputSchema.parse(rawInput);
      return await scope(accountId, input.projectId, "read", async (tx) => {
        if (!tx.readOnly) {
          // Work can complete after the last GitHub read: observe it now.
          await refreshAttentionSignals(tx, now());
        }
        return await presentSignals(tx, (await tx.keyScope()).works);
      });
    },

    async createWorkAndLink(accountId, rawInput) {
      const input = gitHubCreateWorkInputSchema.parse(rawInput);
      return await scope(accountId, input.projectId, "write", async (tx) => {
        const record = await requireRecord(tx, input.recordId);
        if (record.kind !== "Issue") {
          throw new GitHubWorkLinkTargetError(
            "Create work and link starts from a GitHub Issue.",
          );
        }
        const work = await tx.createWork({
          description: input.description,
          originRecordId: record.id,
          title: input.title,
          type: input.type,
        });
        const row: GitHubStoredWorkLink = {
          createdAt: now().toISOString(),
          createdByAccountId: accountId,
          id: newId(),
          kind: "Issue",
          matchedKey: null,
          origin: "Create work and link",
          projectId: input.projectId,
          recordId: record.id,
          removedAt: null,
          repositoryLinkId: record.linkId,
          role: GITHUB_ROLE_CONTEXTUAL_LABEL,
          targetKey: record.id,
          value: null,
          workId: work.id,
        };
        await tx.insertWorkLink(row);
        await refreshAttentionSignals(tx, now());
        return {
          link: await presentOne(tx, row.id),
          work: {
            closureResult: work.closureResult,
            id: work.id,
            key: work.key,
            status: work.status,
            title: work.title,
          },
        };
      });
    },

    async dismissSignal(accountId, rawInput) {
      const input = gitHubDismissSignalInputSchema.parse(rawInput);
      await scope(accountId, input.projectId, "write", async (tx) => {
        const signal = (await tx.signals()).find(
          (row) => row.signalId === input.signalId,
        );
        if (!signal) {
          throw new GitHubSignalNotFoundError();
        }
        await tx.updateSignal(signal.signalId, {
          dismissedAt: now().toISOString(),
        });
      });
    },

    async linkWork(accountId, rawInput) {
      const input = gitHubLinkWorkInputSchema.parse(rawInput);
      return await scope(accountId, input.projectId, "write", async (tx) => {
        const work = await requireWork(tx, input.workId);
        const { kind, recordId, repositoryLinkId, targetKey, value } =
          await resolveTarget(tx, input.target);
        if (
          input.role === GITHUB_ROLE_REQUIRED_LABEL &&
          kind !== "Pull request"
        ) {
          throw new GitHubWorkLinkRoleError();
        }
        const existing = (await tx.workLinks()).find(
          (candidate) =>
            candidate.targetKey === targetKey &&
            workFor([work], candidate.workId) !== null,
        );
        if (existing && !existing.removedAt) {
          throw new GitHubWorkLinkExistsError();
        }
        if (existing) {
          // A removed automatic link is replaced by the founder's explicit one.
          await tx.updateWorkLink(existing.id, {
            matchedKey: null,
            origin: "Manual",
            removedAt: null,
            role: input.role,
          });
          await refreshAttentionSignals(tx, now());
          return await presentOne(tx, existing.id);
        }
        const row: GitHubStoredWorkLink = {
          createdAt: now().toISOString(),
          createdByAccountId: accountId,
          id: newId(),
          kind,
          matchedKey: null,
          origin: "Manual",
          projectId: input.projectId,
          recordId,
          removedAt: null,
          repositoryLinkId,
          role: input.role,
          targetKey,
          value,
          workId: work.id,
        };
        await tx.insertWorkLink(row);
        await refreshAttentionSignals(tx, now());
        return await presentOne(tx, row.id);
      });
    },

    async previewCreateWork(
      accountId,
      rawInput,
    ): Promise<GitHubCreateWorkPreview> {
      const input = gitHubCreateWorkPreviewInputSchema.parse(rawInput);
      return await scope(accountId, input.projectId, "read", async (tx) => {
        const record = await requireRecord(tx, input.recordId);
        if (record.kind !== "Issue") {
          throw new GitHubWorkLinkTargetError(
            "Create work and link starts from a GitHub Issue.",
          );
        }
        return {
          draft: {
            description: `From GitHub Issue #${record.number}: ${record.htmlUrl}`,
            startingStatus: "Not Started" as const,
            title: record.title,
            type: "Task" as const,
          },
          effects: [
            "One Work is created from the fields above, once.",
            "The Work links this Issue as Contextual; the link stays visible and removable.",
            "Later edits on either side do not sync to the other.",
            "Nothing is written to GitHub.",
          ],
          recordId: record.id,
          source: {
            htmlUrl: record.htmlUrl,
            kind: "Issue" as const,
            number: record.number,
            title: record.title,
          },
          syncsFields: false as const,
          writesGitHub: false as const,
        };
      });
    },

    async unlinkWork(accountId, rawInput) {
      const input = gitHubUnlinkWorkInputSchema.parse(rawInput);
      await scope(accountId, input.projectId, "write", async (tx) => {
        const row = (await tx.workLinks()).find(
          (candidate) => candidate.id === input.linkId && !candidate.removedAt,
        );
        if (!row) {
          throw new GitHubWorkLinkNotFoundError(input.linkId);
        }
        if (row.origin === "Key match") {
          // Kept as a mark so the same key is not matched again.
          await tx.updateWorkLink(row.id, { removedAt: now().toISOString() });
        } else {
          await tx.deleteWorkLink(row.id);
        }
        await refreshAttentionSignals(tx, now());
      });
    },

    async workLinks(accountId, rawInput): Promise<GitHubWorkLinksOverview> {
      const input = gitHubWorkLinksInputSchema.parse(rawInput);
      return await scope(accountId, input.projectId, "read", async (tx) => {
        const { works } = await tx.keyScope();
        const rows = (await tx.workLinks()).filter((row) => !row.removedAt);
        const records = new Map(
          (await tx.records()).map((record) => [record.id, record]),
        );
        const suggestions: GitHubSuggestion[] = [];
        for (const row of await tx.suggestions()) {
          const record = records.get(row.recordId);
          if (!record || record.lifecycle === "Trash") {
            continue;
          }
          const work = row.workId ? workFor(works, row.workId) : null;
          suggestions.push({
            closingIntent: row.closingIntent,
            id: row.id,
            key: row.key,
            reason: row.reason,
            recordId: row.recordId,
            workId: work?.id ?? null,
            workKey: work?.key ?? null,
            workTitle: work?.title ?? null,
          });
        }
        return {
          links: await presentLinks(tx, rows, works),
          readOnly: tx.readOnly,
          signals: await presentSignals(tx, works),
          suggestions,
          works: works
            .filter((work) => !work.trashed)
            .map((work) => ({
              closureResult: work.closureResult,
              id: work.id,
              key: work.key,
              status: work.status,
              title: work.title,
            })),
        };
      });
    },
  };
}
