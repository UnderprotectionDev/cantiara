// biome-ignore-all lint/performance/noAwaitInLoops: Overview presents each link in order, one read per link.
import {
  GITHUB_APP_PERMISSIONS,
  GITHUB_CONTENTS_REASON,
  GITHUB_FIRST_SYNC_BUDGET_MS,
  GITHUB_OUT_OF_DATE_AFTER_MS,
  type GitHubAppGateway,
  type GitHubConnection,
  type GitHubExternalRecord,
  type GitHubExternalRecordWrite,
  type GitHubIntegrationAccess,
  type GitHubIntegrationStore,
  type GitHubIntegrationTransaction,
  type GitHubIssueSnapshot,
  type GitHubLinkPreview,
  type GitHubOverview,
  type GitHubRecordWriteOutcome,
  type GitHubRepository,
  type GitHubRepositoryLink,
  type GitHubStoredInstallation,
  type GitHubStoredLink,
  type GitHubStoredRecord,
  type GitHubSyncStatus,
  type GitHubWebhookEvent,
  gitHubAvailableRepositoriesInputSchema,
  gitHubInstallCompleteInputSchema,
  gitHubInstallStartInputSchema,
  gitHubLinkInputSchema,
  gitHubLinkRepositoryInputSchema,
  gitHubProjectInputSchema,
  gitHubRecordInputSchema,
  gitHubReincludeInputSchema,
  gitHubSearchRecordsInputSchema,
  groupTriageCandidates,
} from "@cantiara/api/github-integration";
import {
  deriveReviewerStates,
  type GitHubReviewer,
} from "@cantiara/api/github-pr-context";

import {
  GitHubRateLimitedError,
  GitHubRequestError,
} from "./github-app-gateway";
import {
  applyCheckEvent,
  applyCheckReads,
  createGitHubChecks,
  observePullHead,
} from "./github-checks";
import type { GitHubSecrets } from "./github-credential-envelope";
import { createGitHubPrContext, reviewerKey } from "./github-pr-context";
import {
  applyKeyMatches,
  createGitHubWorkLinks,
  refreshAttentionSignals,
  storableSnapshot,
} from "./github-work-links";

class GitHubIntegrationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GitHubIntegrationError";
  }
}

export class GitHubProjectNotFoundError extends GitHubIntegrationError {
  constructor(projectId: string) {
    super("GITHUB_PROJECT_NOT_FOUND", `Project ${projectId} was not found.`);
  }
}

export class GitHubProjectReadOnlyError extends GitHubIntegrationError {
  constructor(projectId: string) {
    super(
      "GITHUB_PROJECT_READ_ONLY",
      `Project ${projectId} is archived and read-only.`,
    );
  }
}

export class GitHubAppNotConfiguredError extends GitHubIntegrationError {
  constructor() {
    super("GITHUB_APP_NOT_CONFIGURED", "The GitHub App is not configured.");
  }
}

export class GitHubInstallStateInvalidError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_INSTALL_STATE_INVALID",
      "The GitHub App install link is invalid or expired. Start again.",
    );
  }
}

export class GitHubInstallationNotFoundError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_INSTALLATION_NOT_FOUND",
      "GitHub does not know this installation.",
    );
  }
}

export class GitHubInstallationClaimedError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_INSTALLATION_CLAIMED",
      "This installation is already connected by another account.",
    );
  }
}

/** An installation created too long ago cannot prove it came through this flow. */
export class GitHubInstallationUnclaimableError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_INSTALLATION_UNCLAIMABLE",
      "This installation cannot be connected from here. Install the GitHub App for it again, starting from this Project.",
    );
  }
}

/** GitHub could not be read (rate limit, outage); the founder retries later. */
export class GitHubUnavailableError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_UNAVAILABLE",
      "GitHub could not be read right now. Try again in a moment.",
    );
  }
}

export class GitHubInstallationRemovedError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_INSTALLATION_REMOVED",
      "The GitHub App was uninstalled. Install it again, then select the same Repository.",
    );
  }
}

export class GitHubRepositoryUnavailableError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_REPOSITORY_UNAVAILABLE",
      "This Repository is not available to the GitHub App.",
    );
  }
}

export class GitHubLinkNotFoundError extends GitHubIntegrationError {
  constructor(linkId: string) {
    super("GITHUB_LINK_NOT_FOUND", `Repository link ${linkId} was not found.`);
  }
}

export class GitHubRecordNotFoundError extends GitHubIntegrationError {
  constructor(recordId: string) {
    super(
      "GITHUB_RECORD_NOT_FOUND",
      `GitHub record ${recordId} was not found.`,
    );
  }
}

export class GitHubRecordNotInTrashError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_RECORD_NOT_IN_TRASH",
      "Only a GitHub record in Trash can be deleted permanently.",
    );
  }
}

export class GitHubReincludeUnavailableError extends GitHubIntegrationError {
  constructor() {
    super(
      "GITHUB_REINCLUDE_UNAVAILABLE",
      "The source cannot be re-included: it was not deleted permanently, the link is not connected, or GitHub no longer shows it.",
    );
  }
}

export interface GitHubIntegrationOptions {
  /** `null` while the App credentials are not configured. */
  gateway: GitHubAppGateway | null;
  newId?: () => string;
  now?: () => Date;
  secrets: GitHubSecrets;
  store: GitHubIntegrationStore;
}

/**
 * A refusal that must commit what the unit of work already wrote (a stop
 * reason, a removed installation) before the caller sees the error.
 */
class Refusal {
  readonly error: Error;

  constructor(error: Error) {
    this.error = error;
  }
}

const LEADING_HASH = /^#/;
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const SEARCH_LIMIT = 200;
/**
 * A brand-new claim may only connect an installation GitHub created around the
 * install attempt (state TTL plus patience). Older installations of other
 * accounts cannot be swept up by guessing installation ids.
 */
const INSTALL_CLAIM_GRACE_MS = 20 * 60 * 1000;
/** An incremental read re-asks a little before the last cursor: GitHub timestamps can lag. */
const SINCE_OVERLAP_MS = 5 * 60 * 1000;

type ReconcileOutcome =
  | "disconnected"
  | "failed"
  | "paused"
  | "rate-limited"
  | "ran";

interface ReconcileReport {
  applied: number;
  outcome: ReconcileOutcome;
  restoredDiffs: {
    from: { sourceState: GitHubExternalRecord["sourceState"]; title: string };
    recordId: string;
    to: { sourceState: GitHubExternalRecord["sourceState"]; title: string };
  }[];
  stale: number;
}

function toExternalRecord(record: GitHubStoredRecord): GitHubExternalRecord {
  const { appliedFrom: _appliedFrom, ...external } = record;
  return external;
}

/**
 * One Pull request is one GitHub dış kaydı whichever path applied it first.
 * GitHub carries two id sequences for it (Issues endpoints answer with the
 * issue id, the pull_request webhook payload has the pull request id); the
 * stored number is the identity both paths share, so a snapshot reuses the
 * stored record's githubId instead of building a second record.
 */
async function canonicalSnapshots(
  transaction: GitHubIntegrationTransaction,
  linkId: string,
  snapshots: GitHubIssueSnapshot[],
): Promise<GitHubIssueSnapshot[]> {
  for (const snapshot of snapshots) {
    if (snapshot.kind !== "Pull request") {
      continue;
    }
    const stored = await transaction.recordByNumber(
      linkId,
      "Pull request",
      snapshot.number,
    );
    if (stored && stored.githubId !== snapshot.githubId) {
      snapshot.githubId = stored.githubId;
    }
  }
  return snapshots;
}

function failureText(error: unknown) {
  return error instanceof GitHubRequestError
    ? error.message
    : "The sync failed unexpectedly. It will be retried.";
}

/**
 * A founder-facing GitHub read (token mint, repository or issue lookup) that
 * fails for transport reasons must answer as one readable refusal, never as an
 * unclassified server error. Reconcile handles its own rate-limit wait.
 */
async function githubOrUnavailable<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (
      error instanceof GitHubRateLimitedError ||
      error instanceof GitHubRequestError
    ) {
      // biome-ignore lint/style/useErrorCause: The GitHub error text must not carry response details to the client.
      throw new GitHubUnavailableError();
    }
    throw error;
  }
}

export function createGitHubIntegration(
  options: GitHubIntegrationOptions,
): GitHubIntegrationAccess {
  const { store, secrets } = options;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());

  const requireGateway = () => {
    if (!options.gateway) {
      throw new GitHubAppNotConfiguredError();
    }
    return options.gateway;
  };

  async function inScope<T>(
    accountId: string,
    projectId: string,
    mode: "read" | "write",
    work: (transaction: GitHubIntegrationTransaction) => Promise<T | Refusal>,
  ): Promise<T> {
    const result = await store.run(
      accountId,
      projectId,
      mode,
      (transaction) => {
        if (mode === "write" && transaction.readOnly) {
          throw new GitHubProjectReadOnlyError(projectId);
        }
        return work(transaction);
      },
    );
    if (result === null) {
      throw new GitHubProjectNotFoundError(projectId);
    }
    if (result instanceof Refusal) {
      throw result.error;
    }
    return result;
  }

  async function storeToken(
    transaction: GitHubIntegrationTransaction,
    installation: GitHubStoredInstallation,
    minted: { expiresAt: string; token: string },
  ) {
    await transaction.saveCredential(installation.id, {
      expiresAt: minted.expiresAt,
      sealed: secrets.seal(minted.token, installation.id),
    });
  }

  /** Mints and seals a fresh token; `null` means GitHub no longer knows the installation. */
  async function rotateToken(
    transaction: GitHubIntegrationTransaction,
    installation: GitHubStoredInstallation,
  ) {
    const minted = await requireGateway().mintInstallationToken(
      installation.installationId,
    );
    if (!minted) {
      return null;
    }
    await storeToken(transaction, installation, minted);
    return minted.token;
  }

  async function usableToken(
    transaction: GitHubIntegrationTransaction,
    installation: GitHubStoredInstallation,
  ) {
    const stored = await transaction.loadCredential(installation.id);
    if (
      stored &&
      Date.parse(stored.expiresAt) - now().getTime() > TOKEN_REFRESH_MARGIN_MS
    ) {
      return secrets.open(stored.sealed, installation.id);
    }
    return await rotateToken(transaction, installation);
  }

  async function activeInstallation(
    transaction: GitHubIntegrationTransaction,
    installationId: number,
  ) {
    const installation =
      await transaction.installationByGitHubId(installationId);
    if (!installation) {
      throw new GitHubInstallationNotFoundError();
    }
    if (installation.removedAt) {
      throw new GitHubInstallationRemovedError();
    }
    return installation;
  }

  async function tokenOrRemoved(
    transaction: GitHubIntegrationTransaction,
    installation: GitHubStoredInstallation,
  ) {
    const token = await usableToken(transaction, installation);
    if (!token) {
      await markRemoved(transaction, installation.installationId);
      return new Refusal(new GitHubInstallationRemovedError());
    }
    return token;
  }

  async function markRemoved(
    transaction: GitHubIntegrationTransaction,
    installationId: number,
  ) {
    const removedAt = now().toISOString();
    const installation =
      await transaction.installationByGitHubId(installationId);
    if (!installation) {
      return;
    }
    if (!installation.removedAt) {
      await transaction.updateInstallation(installation.id, { removedAt });
    }
    for (const link of await transaction.links()) {
      if (
        link.installationRowId === installation.id &&
        !link.disconnectedAt &&
        !link.stopReason
      ) {
        await stopLink(transaction, link.id, "App uninstalled");
      }
    }
  }

  /** Access revoked, Repository not found and App uninstalled stop sync and say why. */
  async function stopLink(
    transaction: GitHubIntegrationTransaction,
    linkId: string,
    reason: NonNullable<GitHubStoredLink["stopReason"]>,
  ) {
    await transaction.updateLink(linkId, { stopReason: reason });
    await transaction.appendHistory(linkId, {
      at: now().toISOString(),
      detail: reason,
      kind: "stopped",
    });
  }

  /** The same stable id seen under a new owner or name is the same link. */
  async function observeIdentity(
    transaction: GitHubIntegrationTransaction,
    link: GitHubStoredLink,
    repository: GitHubRepository,
  ) {
    if (link.owner === repository.owner && link.name === repository.name) {
      return;
    }
    await transaction.recordNameHistory(link.id, {
      name: link.name,
      observedAt: now().toISOString(),
      owner: link.owner,
    });
    await transaction.updateLink(link.id, {
      htmlUrl: repository.htmlUrl,
      name: repository.name,
      owner: repository.owner,
    });
  }

  /**
   * One read-only reconcile of one link. It never writes to GitHub, respects
   * rate limits instead of polling, and always leaves the outcome on the link:
   * last success, last error or the wait until GitHub allows another read.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One read-only reconcile keeps stop reasons, rate limits, ordering outcomes and the sync record in one unit of work.
  async function reconcileInTx(
    transaction: GitHubIntegrationTransaction,
    link: GitHubStoredLink,
    syncOptions: { explicit: boolean },
  ): Promise<ReconcileReport> {
    const report: ReconcileReport = {
      applied: 0,
      outcome: "ran",
      restoredDiffs: [],
      stale: 0,
    };
    if (link.disconnectedAt || link.stopReason) {
      return { ...report, outcome: "disconnected" };
    }
    if (transaction.readOnly || link.pausedAt) {
      if (!link.pausedAt) {
        await transaction.updateLink(link.id, {
          pausedAt: now().toISOString(),
        });
        await transaction.appendHistory(link.id, {
          at: now().toISOString(),
          detail: "Project archived",
          kind: "paused",
        });
      }
      return { ...report, outcome: "paused" };
    }
    if (
      link.rateLimitedUntil &&
      Date.parse(link.rateLimitedUntil) > now().getTime()
    ) {
      return { ...report, outcome: "rate-limited" };
    }
    const installation = (await transaction.installations()).find(
      ({ id }) => id === link.installationRowId,
    );
    if (!installation || installation.removedAt) {
      await stopLink(transaction, link.id, "App uninstalled");
      return { ...report, outcome: "disconnected" };
    }
    const startedAt = now();
    try {
      const gateway = requireGateway();
      const token = await usableToken(transaction, installation);
      if (!token) {
        await markRemoved(transaction, installation.installationId);
        return { ...report, outcome: "disconnected" };
      }
      const probe = await gateway.probeRepository(token, link.repositoryId);
      if (probe.status !== "ok") {
        await stopLink(
          transaction,
          link.id,
          probe.status === "forbidden"
            ? "Access revoked"
            : "Repository not found",
        );
        return { ...report, outcome: "disconnected" };
      }
      await observeIdentity(transaction, link, probe.repository);
      const since = link.syncCursor
        ? new Date(Date.parse(link.syncCursor) - SINCE_OVERLAP_MS).toISOString()
        : undefined;
      const fetched = await gateway.listIssues(token, probe.repository, {
        since,
      });
      if (syncOptions.explicit) {
        // A restored record's missed state is read again by number, then applied.
        for (const record of await transaction.records(link.id)) {
          if (!record.needsReconcile) {
            continue;
          }
          const missed = await gateway.getIssue(
            token,
            probe.repository,
            record.number,
          );
          if (missed) {
            fetched.push(missed);
          }
        }
      }
      const snapshots = await canonicalSnapshots(transaction, link.id, fetched);
      const outcomes = await transaction.upsertExternalRecords(
        snapshots.map(
          (snapshot): GitHubExternalRecordWrite => ({
            id: newId(),
            linkId: link.id,
            projectId: link.projectId,
            snapshot: storableSnapshot(snapshot),
          }),
        ),
        { explicit: syncOptions.explicit, origin: "reconcile" },
      );
      await applyIngested(transaction, outcomes, snapshots);
      // Read-only PR check summary: current head SHA and its checks (no log).
      await applyCheckReads(
        transaction,
        link.id,
        await gateway.listPullRequestChecks(token, probe.repository),
        now(),
      );
      await refreshAttentionSignals(transaction, now());
      for (const outcome of outcomes) {
        if (outcome.result === "applied") {
          report.applied += 1;
        } else if (outcome.result === "stale") {
          report.stale += 1;
        }
        if (outcome.conflict) {
          await transaction.appendHistory(link.id, {
            at: startedAt.toISOString(),
            detail: `Conflict at the same updated_at for ${outcome.kind} ${outcome.githubId}; the reconcile snapshot was kept.`,
            kind: "conflict",
          });
        }
        if (
          outcome.replaced &&
          outcome.recordId &&
          outcome.result === "applied"
        ) {
          const applied = snapshots.find(
            (snapshot) =>
              snapshot.kind === outcome.kind &&
              snapshot.githubId === outcome.githubId,
          );
          if (applied) {
            report.restoredDiffs.push({
              from: outcome.replaced,
              recordId: outcome.recordId,
              to: { sourceState: applied.sourceState, title: applied.title },
            });
          }
        }
      }
      await transaction.updateLink(link.id, {
        lastError: null,
        lastErrorAt: null,
        lastSuccessAt: startedAt.toISOString(),
        rateLimitedUntil: null,
        syncCursor: startedAt.toISOString(),
      });
      return report;
    } catch (error) {
      if (error instanceof GitHubRateLimitedError) {
        const until = new Date(
          startedAt.getTime() + error.retryAfterSeconds * 1000,
        ).toISOString();
        await transaction.updateLink(link.id, {
          lastError: `GitHub rate limit reached. The next read waits until ${until}.`,
          lastErrorAt: startedAt.toISOString(),
          rateLimitedUntil: until,
        });
        return { ...report, outcome: "rate-limited" };
      }
      await transaction.updateLink(link.id, {
        lastError: failureText(error),
        lastErrorAt: startedAt.toISOString(),
      });
      return { ...report, outcome: "failed" };
    }
  }

  function connectionOf(
    transaction: GitHubIntegrationTransaction,
    link: GitHubStoredLink,
  ): GitHubConnection {
    if (link.disconnectedAt || link.stopReason) {
      return "Disconnected";
    }
    // Archive pauses the link; leaving the archive does not resume it.
    return link.pausedAt || transaction.readOnly ? "Paused" : "Connected";
  }

  function syncStatusOf(
    link: GitHubStoredLink,
    connection: GitHubConnection,
  ): GitHubSyncStatus {
    const reference = Date.parse(link.lastSuccessAt ?? link.linkedAt);
    const behind = now().getTime() - reference;
    return {
      // Past the budget a connected link says so; stale data is never shown as current.
      firstSyncOverdue:
        link.lastSuccessAt === null &&
        now().getTime() - Date.parse(link.linkedAt) >
          GITHUB_FIRST_SYNC_BUDGET_MS,
      lastError: link.lastError,
      lastErrorAt: link.lastErrorAt,
      lastSuccessAt: link.lastSuccessAt,
      outOfDate:
        connection === "Connected" && behind > GITHUB_OUT_OF_DATE_AFTER_MS,
      rateLimitedUntil:
        link.rateLimitedUntil &&
        Date.parse(link.rateLimitedUntil) > now().getTime()
          ? link.rateLimitedUntil
          : null,
    };
  }

  async function present(
    transaction: GitHubIntegrationTransaction,
    link: GitHubStoredLink,
    installation: GitHubStoredInstallation | undefined,
  ): Promise<GitHubRepositoryLink> {
    const [history, externalRecordCount] = await Promise.all([
      transaction.nameHistory(link.id),
      transaction.countRecords(link.id),
    ]);
    const connection = connectionOf(transaction, link);
    return {
      accountLogin: installation?.accountLogin ?? "",
      connection,
      pauseReason: connection === "Paused" ? "Project archived" : null,
      sync: syncStatusOf(link, connection),
      disconnectedAt: link.disconnectedAt,
      externalRecordCount,
      htmlUrl: link.htmlUrl,
      id: link.id,
      installationId: installation?.installationId ?? 0,
      linkedAt: link.linkedAt,
      name: link.name,
      owner: link.owner,
      previousNames: history,
      projectId: link.projectId,
      repositoryId: link.repositoryId,
      stopReason: link.stopReason,
      triage: link.triage,
    };
  }

  async function presentLink(
    transaction: GitHubIntegrationTransaction,
    linkId: string,
  ) {
    const link = await transaction.linkById(linkId);
    if (!link) {
      throw new GitHubLinkNotFoundError(linkId);
    }
    const installations = await transaction.installations();
    return await present(
      transaction,
      link,
      installations.find(({ id }) => id === link.installationRowId),
    );
  }

  async function requireLink(
    transaction: GitHubIntegrationTransaction,
    linkId: string,
  ) {
    const link = await transaction.linkById(linkId);
    if (!link) {
      throw new GitHubLinkNotFoundError(linkId);
    }
    const installations = await transaction.installations();
    const installation = installations.find(
      ({ id }) => id === link.installationRowId,
    );
    if (!installation) {
      throw new GitHubLinkNotFoundError(linkId);
    }
    return { installation, link };
  }

  async function recordOf(
    transaction: GitHubIntegrationTransaction,
    recordId: string,
  ) {
    const record = await transaction.recordById(recordId);
    if (!record) {
      throw new GitHubRecordNotFoundError(recordId);
    }
    return record;
  }

  /**
   * After records were applied: match Work keys on what changed and recompute
   * the two attention signals. Only this seam's own rows are written.
   */
  async function applyIngested(
    transaction: GitHubIntegrationTransaction,
    outcomes: GitHubRecordWriteOutcome[],
    snapshots: GitHubIssueSnapshot[],
  ) {
    const entries: { recordId: string; snapshot: GitHubIssueSnapshot }[] = [];
    for (const outcome of outcomes) {
      const snapshot = snapshots.find(
        (candidate) =>
          candidate.kind === outcome.kind &&
          candidate.githubId === outcome.githubId,
      );
      if (outcome.result === "applied" && outcome.recordId && snapshot) {
        entries.push({ recordId: outcome.recordId, snapshot });
      }
    }
    const headEntries = entries.filter(({ snapshot }) => snapshot.headSha);
    const headRecords = new Map(
      (
        await transaction.recordsByIds(
          headEntries.map(({ recordId }) => recordId),
        )
      ).map((record) => [record.id, record]),
    );
    for (const { recordId, snapshot } of entries) {
      // A Pull request payload names its head SHA: results of an older SHA are superseded.
      const record = snapshot.headSha ? headRecords.get(recordId) : undefined;
      if (record && snapshot.headSha) {
        await observePullHead(transaction, record, snapshot.headSha, now());
      }
    }
    await applyKeyMatches(transaction, entries, { newId, now });
    await refreshAttentionSignals(transaction, now());
  }

  async function lifecycleChange(
    accountId: string,
    rawInput: unknown,
    change: (
      transaction: GitHubIntegrationTransaction,
      record: GitHubStoredRecord,
    ) => Promise<void>,
  ) {
    const input = gitHubRecordInputSchema.parse(rawInput);
    return await inScope(accountId, input.projectId, "write", async (tx) => {
      await change(tx, await recordOf(tx, input.recordId));
      await refreshAttentionSignals(tx, now());
      return toExternalRecord(await recordOf(tx, input.recordId));
    });
  }

  async function preview(
    accountId: string,
    rawInput: unknown,
    action: GitHubLinkPreview["action"],
  ): Promise<GitHubLinkPreview> {
    const input = gitHubLinkInputSchema.parse(rawInput);
    return await inScope(accountId, input.projectId, "read", async (tx) => {
      const { link } = await requireLink(tx, input.linkId);
      const records = await tx.records(link.id);
      const link_ = await presentLink(tx, link.id);
      const effects =
        action === "Disconnect"
          ? [
              "Captured records stay as historical sources with their last source state.",
              "New syncing stops and the stored GitHub credential is no longer used.",
              "Nothing is written to GitHub.",
            ]
          : [
              "A new credential is minted and the link is read again from the current source.",
              "Events missed while paused or stopped are not recreated.",
              "Nothing is written to GitHub.",
            ];
      return {
        action,
        affected: {
          issues: records.filter((record) => record.kind === "Issue").length,
          pullRequests: records.filter(
            (record) => record.kind === "Pull request",
          ).length,
          repository: `${link.owner}/${link.name}`,
        },
        effects,
        link: link_,
      };
    });
  }

  /** The exact commit through the allow-listed Git database endpoint; no tree, no patch. */
  async function resolveCommit(
    transaction: GitHubIntegrationTransaction,
    link: GitHubStoredLink,
    sha: string,
  ) {
    const gateway = requireGateway();
    const installation = (await transaction.installations()).find(
      ({ id }) => id === link.installationRowId,
    );
    if (!installation || installation.removedAt) {
      throw new GitHubInstallationRemovedError();
    }
    const token = await usableToken(transaction, installation);
    if (!token) {
      throw new GitHubInstallationRemovedError();
    }
    const commit = await githubOrUnavailable(() =>
      gateway.resolveCommit(token, link, sha),
    );
    return commit?.sha ?? null;
  }

  const workLinks = createGitHubWorkLinks({
    newId,
    now,
    resolveCommit,
    scope: inScope,
    store,
  });

  const checkSummary = createGitHubChecks({ scope: inScope, store });

  /**
   * A usable token for reading reviewers. A stored token is reused; only an
   * expired one is rotated (the one credential write), and any failure means
   * GitHub supplies no reviewer data for this card, never a failed read.
   */
  async function reviewerToken(
    accountId: string,
    projectId: string,
    linkId: string,
  ) {
    const open = async (
      tx: GitHubIntegrationTransaction,
      mode: "read" | "write",
    ) => {
      const link = await tx.linkById(linkId);
      if (!link || link.disconnectedAt || link.stopReason) {
        return null;
      }
      const installation = (await tx.installations()).find(
        ({ id }) => id === link.installationRowId,
      );
      if (!installation || installation.removedAt) {
        return null;
      }
      const stored = await tx.loadCredential(installation.id);
      if (
        stored &&
        Date.parse(stored.expiresAt) - now().getTime() > TOKEN_REFRESH_MARGIN_MS
      ) {
        return { link, token: secrets.open(stored.sealed, installation.id) };
      }
      if (mode === "read") {
        return;
      }
      const token = await usableToken(tx, installation);
      return token ? { link, token } : null;
    };
    try {
      const fromRead = await inScope(accountId, projectId, "read", (tx) =>
        open(tx, "read"),
      );
      if (fromRead !== undefined) {
        return fromRead;
      }
      return await inScope(accountId, projectId, "write", (tx) =>
        open(tx, "write"),
      );
    } catch {
      return null;
    }
  }

  const prContext = createGitHubPrContext({
    reviewers: async (accountId, projectId, targets) => {
      const reviewers = new Map<string, GitHubReviewer[]>();
      const { gateway } = options;
      if (!gateway) {
        return reviewers;
      }
      for (const target of targets) {
        try {
          const opened = await reviewerToken(
            accountId,
            projectId,
            target.linkId,
          );
          if (!opened) {
            continue;
          }
          const read = await gateway.listPullRequestReviewers(
            opened.token,
            opened.link,
            target.number,
          );
          reviewers.set(reviewerKey(target), deriveReviewerStates(read));
        } catch {
          // GitHub supplied nothing (rate limit, outage): the card shows no reviewers.
        }
      }
      return reviewers;
    },
    scope: inScope,
  });

  const base: Omit<
    GitHubIntegrationAccess,
    keyof typeof workLinks | keyof typeof checkSummary | keyof typeof prContext
  > = {
    async applyWebhookEvent(event: GitHubWebhookEvent) {
      if (event.kind === "installation-removed") {
        await store.runForInstallation(event.installationId, (tx) =>
          markRemoved(tx, event.installationId),
        );
        return "installation removed";
      }
      const results: string[] = [];
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Each webhook event kind maps to one link effect inside one installation scope.
      await store.runForInstallation(event.installationId, async (tx) => {
        const repositoryId =
          event.kind === "repository-renamed"
            ? event.repository.repositoryId
            : event.repositoryId;
        const link = await tx.linkByRepositoryId(repositoryId);
        if (!link) {
          results.push("no link");
          return;
        }
        if (link.disconnectedAt || link.stopReason) {
          results.push("disconnected");
          return;
        }
        if (tx.readOnly || link.pausedAt) {
          // Paused by archive: no event is applied or invented for the gap.
          if (!link.pausedAt) {
            await tx.updateLink(link.id, { pausedAt: now().toISOString() });
            await tx.appendHistory(link.id, {
              at: now().toISOString(),
              detail: "Project archived",
              kind: "paused",
            });
          }
          results.push("paused");
          return;
        }
        if (event.kind === "repository-access-removed") {
          await stopLink(tx, link.id, "Access revoked");
          results.push("access revoked");
        } else if (event.kind === "repository-missing") {
          await stopLink(tx, link.id, "Repository not found");
          results.push("repository not found");
        } else if (event.kind === "repository-renamed") {
          await observeIdentity(tx, link, event.repository);
          results.push("renamed");
        } else if (event.kind === "check") {
          const matched = await applyCheckEvent(tx, link.id, event, now());
          await refreshAttentionSignals(tx, now());
          results.push(matched > 0 ? "check applied" : "check ignored");
        } else {
          const snapshots = await canonicalSnapshots(tx, link.id, [
            event.snapshot,
          ]);
          const outcomes = await tx.upsertExternalRecords(
            snapshots.map(
              (snapshot): GitHubExternalRecordWrite => ({
                id: newId(),
                linkId: link.id,
                projectId: link.projectId,
                snapshot: storableSnapshot(snapshot),
              }),
            ),
            { explicit: false, origin: "webhook" },
          );
          await applyIngested(tx, outcomes, snapshots);
          results.push(outcomes[0]?.result ?? "ignored");
        }
      });
      return results.length > 0 ? results.join(", ") : "no link";
    },

    async archiveRecord(accountId, rawInput) {
      return await lifecycleChange(accountId, rawInput, (tx, record) =>
        tx.setRecordLifecycle(record.id, { archivedAt: now().toISOString() }),
      );
    },

    async deleteRecordPermanently(accountId, rawInput) {
      const input = gitHubRecordInputSchema.parse(rawInput);
      await inScope(accountId, input.projectId, "write", async (tx) => {
        const record = await recordOf(tx, input.recordId);
        if (record.lifecycle !== "Trash") {
          return new Refusal(new GitHubRecordNotInTrashError());
        }
        await tx.deleteRecordWithTombstone(record.id, now().toISOString());
        return true;
      });
    },

    async previewDisconnect(accountId, rawInput) {
      return await preview(accountId, rawInput, "Disconnect");
    },

    async previewReconnect(accountId, rawInput) {
      return await preview(accountId, rawInput, "Reconnect");
    },

    async reconcileDue() {
      const totals = { failed: 0, ran: 0, skipped: 0 };
      for (const scope of await store.linkScopes()) {
        try {
          const report = await store.runForProject(
            scope.projectId,
            async (tx) => {
              const link = await tx.linkById(scope.linkId);
              return link
                ? await reconcileInTx(tx, link, { explicit: false })
                : null;
            },
          );
          if (report?.outcome === "ran") {
            totals.ran += 1;
          } else if (report?.outcome === "failed") {
            totals.failed += 1;
          } else {
            totals.skipped += 1;
          }
        } catch {
          totals.failed += 1;
        }
      }
      return totals;
    },

    async reincludeRecord(accountId, rawInput) {
      const input = gitHubReincludeInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "write", async (tx) => {
        const { installation, link } = await requireLink(tx, input.linkId);
        const tombstone = await tx.tombstone(
          link.id,
          input.kind,
          input.githubId,
        );
        if (
          !tombstone ||
          link.disconnectedAt ||
          link.stopReason ||
          link.pausedAt ||
          installation.removedAt
        ) {
          return new Refusal(new GitHubReincludeUnavailableError());
        }
        const token = await usableToken(tx, installation);
        const source = token
          ? await githubOrUnavailable(() =>
              requireGateway().getIssue(token, link, tombstone.number),
            )
          : null;
        if (!source || source.githubId !== input.githubId) {
          return new Refusal(new GitHubReincludeUnavailableError());
        }
        // A new product identity; the permanently deleted one stays visible as origin.
        return toExternalRecord(
          await tx.reincludeRecord({
            id: newId(),
            linkId: link.id,
            origin: {
              deletedAt: tombstone.deletedAt,
              recordId: tombstone.recordId,
            },
            projectId: link.projectId,
            snapshot: source,
          }),
        );
      });
    },

    async restoreRecord(accountId, rawInput) {
      return await lifecycleChange(accountId, rawInput, (tx, record) =>
        // The missed source state is not applied silently: Sync now does it, visibly.
        tx.setRecordLifecycle(record.id, {
          needsReconcile: record.lifecycle === "Trash" ? true : undefined,
          trashedAt: null,
        }),
      );
    },

    async syncNow(accountId, rawInput) {
      const input = gitHubLinkInputSchema.parse(rawInput);
      // Archived Projects answer `paused` instead of refusing the click.
      const result = await store.run(
        accountId,
        input.projectId,
        "write",
        async (tx) => {
          const { link } = await requireLink(tx, input.linkId);
          const report = await reconcileInTx(tx, link, { explicit: true });
          return {
            applied: report.applied,
            link: await presentLink(tx, link.id),
            outcome: report.outcome,
            restoredDiffs: report.restoredDiffs,
            stale: report.stale,
          };
        },
      );
      if (result === null) {
        throw new GitHubProjectNotFoundError(input.projectId);
      }
      return result;
    },

    async trashRecord(accountId, rawInput) {
      return await lifecycleChange(accountId, rawInput, (tx, record) =>
        tx.setRecordLifecycle(record.id, { trashedAt: now().toISOString() }),
      );
    },

    async availableRepositories(accountId, rawInput) {
      const input = gitHubAvailableRepositoriesInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "write", async (tx) => {
        const installation = await activeInstallation(tx, input.installationId);
        const token = await githubOrUnavailable(() =>
          tokenOrRemoved(tx, installation),
        );
        if (token instanceof Refusal) {
          return token;
        }
        const [repositories, links] = await Promise.all([
          githubOrUnavailable(() =>
            requireGateway().listInstallationRepositories(token),
          ),
          tx.links(),
        ]);
        const linked = new Set(
          links
            .filter((link) => !(link.disconnectedAt || link.stopReason))
            .map(({ repositoryId }) => repositoryId),
        );
        return {
          repositories: repositories.map((repository) => ({
            ...repository,
            linked: linked.has(repository.repositoryId),
          })),
        };
      });
    },

    async completeInstall(accountId, rawInput) {
      const input = gitHubInstallCompleteInputSchema.parse(rawInput);
      const state = secrets.verifyState(input.state, now());
      if (!state || state.accountId !== accountId) {
        throw new GitHubInstallStateInvalidError();
      }
      return await inScope(accountId, state.projectId, "write", async (tx) => {
        // Claims of one GitHub installation id complete one at a time.
        await tx.lockInstallationClaim(input.installationId);
        const claims = await tx.claimsOfInstallation(input.installationId);
        if (claims.some((claim) => claim.connectedByAccountId !== accountId)) {
          throw new GitHubInstallationClaimedError();
        }
        const description = await githubOrUnavailable(() =>
          requireGateway().describeInstallation(input.installationId),
        );
        if (!description) {
          throw new GitHubInstallationNotFoundError();
        }
        if (
          claims.length === 0 &&
          (!description.createdAt ||
            Date.parse(description.createdAt) <
              state.expiresAt - INSTALL_CLAIM_GRACE_MS)
        ) {
          // An installation created long before this install attempt cannot
          // be swept up by an installation id; a claim in the same flow can.
          throw new GitHubInstallationUnclaimableError();
        }
        let installation = await tx.installationByGitHubId(
          input.installationId,
        );
        if (installation) {
          await tx.updateInstallation(installation.id, { removedAt: null });
          installation = { ...installation, removedAt: null };
        } else {
          installation = {
            accountLogin: description.accountLogin,
            connectedByAccountId: accountId,
            createdAt: now().toISOString(),
            id: newId(),
            installationId: input.installationId,
            projectId: state.projectId,
            removedAt: null,
          };
          await tx.insertInstallation(installation);
        }
        const token = await githubOrUnavailable(() =>
          rotateToken(tx, installation),
        );
        if (!token) {
          throw new GitHubInstallationNotFoundError();
        }
        return {
          installation: {
            accountLogin: installation.accountLogin,
            id: installation.id,
            installationId: installation.installationId,
            removedAt: null,
          },
          projectId: state.projectId,
          repositories: await githubOrUnavailable(() =>
            requireGateway().listInstallationRepositories(token),
          ),
        };
      });
    },

    async disconnect(accountId, rawInput) {
      const input = gitHubLinkInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "write", async (tx) => {
        const { link } = await requireLink(tx, input.linkId);
        if (!link.disconnectedAt) {
          await tx.updateLink(link.id, {
            disconnectedAt: now().toISOString(),
          });
        }
        // The credential is revoked once no live link still reads through it.
        const stillInUse = (await tx.links()).some(
          (other) =>
            other.id !== link.id &&
            other.installationRowId === link.installationRowId &&
            !other.disconnectedAt &&
            !other.stopReason,
        );
        if (!stillInUse) {
          await tx.deleteCredential(link.installationRowId);
        }
        const presented = await presentLink(tx, link.id);
        // Captured records are historical sources; Disconnect deletes none.
        return {
          keptExternalRecords: presented.externalRecordCount,
          link: presented,
        };
      });
    },

    async linkRepository(accountId, rawInput) {
      const input = gitHubLinkRepositoryInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "write", async (tx) => {
        const installation = await activeInstallation(tx, input.installationId);
        const token = await githubOrUnavailable(() =>
          tokenOrRemoved(tx, installation),
        );
        if (token instanceof Refusal) {
          return token;
        }
        const repositories = await githubOrUnavailable(() =>
          requireGateway().listInstallationRepositories(token),
        );
        const repository = repositories.find(
          ({ repositoryId }) => repositoryId === input.repositoryId,
        );
        if (!repository) {
          return new Refusal(new GitHubRepositoryUnavailableError());
        }
        const existing = await tx.linkByRepositoryId(repository.repositoryId);
        if (existing) {
          // Same stable id: rename, owner change or re-authorization, never a new link.
          await observeIdentity(tx, existing, repository);
          await tx.updateLink(existing.id, {
            disconnectedAt: null,
            installationRowId: installation.id,
            pausedAt: null,
            rateLimitedUntil: null,
            stopReason: null,
            syncCursor: null,
          });
          const relinked = await tx.linkById(existing.id);
          if (relinked) {
            await reconcileInTx(tx, relinked, { explicit: true });
          }
          return await presentLink(tx, existing.id);
        }
        const link: GitHubStoredLink = {
          disconnectedAt: null,
          htmlUrl: repository.htmlUrl,
          id: newId(),
          installationRowId: installation.id,
          linkedAt: now().toISOString(),
          name: repository.name,
          owner: repository.owner,
          projectId: input.projectId,
          repositoryId: repository.repositoryId,
          stopReason: null,
          triage: "Pending",
          lastError: null,
          lastErrorAt: null,
          lastSuccessAt: null,
          pausedAt: null,
          rateLimitedUntil: null,
          syncCursor: null,
        };
        await tx.insertLink(link);
        // First sync of a new link runs now; past 30 minutes the status says so.
        await reconcileInTx(tx, link, { explicit: false });
        return await presentLink(tx, link.id);
      });
    },

    async overview(accountId, rawProjectId): Promise<GitHubOverview> {
      const { projectId } = gitHubProjectInputSchema.parse({
        projectId: rawProjectId,
      });
      return await inScope(accountId, projectId, "read", async (tx) => {
        const installations = await tx.installations();
        const links: GitHubRepositoryLink[] = [];
        for (const link of await tx.links()) {
          links.push(
            await present(
              tx,
              link,
              installations.find(({ id }) => id === link.installationRowId),
            ),
          );
        }
        return {
          app: {
            configured: options.gateway !== null,
            contentsReason: GITHUB_CONTENTS_REASON,
            permissions: GITHUB_APP_PERMISSIONS.map(
              ({ access, permission }) => ({ access, permission }),
            ),
          },
          installations: installations.map((installation) => ({
            accountLogin: installation.accountLogin,
            id: installation.id,
            installationId: installation.installationId,
            removedAt: installation.removedAt,
          })),
          links,
          projectId,
          readOnly: tx.readOnly,
        };
      });
    },

    async reconnect(accountId, rawInput) {
      const input = gitHubLinkInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "write", async (tx) => {
        const { installation, link } = await requireLink(tx, input.linkId);
        if (installation.removedAt) {
          return new Refusal(new GitHubInstallationRemovedError());
        }
        // Reconnect rotates the credential even when the old one is still valid.
        const token = await githubOrUnavailable(() =>
          rotateToken(tx, installation),
        );
        if (!token) {
          await markRemoved(tx, installation.installationId);
          return new Refusal(new GitHubInstallationRemovedError());
        }
        const repository = await githubOrUnavailable(() =>
          requireGateway().getRepository(token, link.repositoryId),
        );
        if (!repository) {
          await tx.updateLink(link.id, { stopReason: "Repository not found" });
          return new Refusal(new GitHubRepositoryUnavailableError());
        }
        await observeIdentity(tx, link, repository);
        // Explicit Reconnect resumes a paused or stopped link and reads the
        // gap again from the current source; nothing missed is invented.
        await tx.updateLink(link.id, {
          disconnectedAt: null,
          pausedAt: null,
          rateLimitedUntil: null,
          stopReason: null,
          syncCursor: null,
        });
        await tx.appendHistory(link.id, {
          at: now().toISOString(),
          detail: "Reconnected",
          kind: "reconnected",
        });
        const resumed = await tx.linkById(link.id);
        if (resumed) {
          await reconcileInTx(tx, resumed, { explicit: false });
        }
        return await presentLink(tx, link.id);
      });
    },

    async recordInstallationRemoved(installationId) {
      await store.runForInstallation(installationId, (tx) =>
        markRemoved(tx, installationId),
      );
    },

    async searchRecords(accountId, rawInput) {
      const input = gitHubSearchRecordsInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "read", async (tx) => {
        // Archived records leave normal lists; Trash records are no search input.
        return {
          records: (
            await tx.searchActiveRecords(
              input.query.toLowerCase().replace(LEADING_HASH, ""),
              SEARCH_LIMIT,
            )
          ).map(toExternalRecord),
        };
      });
    },

    async skipTriage(accountId, rawInput) {
      const input = gitHubLinkInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "write", async (tx) => {
        await requireLink(tx, input.linkId);
        await tx.updateLink(input.linkId, { triage: "Skipped" });
        return await presentLink(tx, input.linkId);
      });
    },

    async startInstall(accountId, rawInput) {
      const input = gitHubInstallStartInputSchema.parse(rawInput);
      const gateway = requireGateway();
      return await inScope(accountId, input.projectId, "write", () =>
        Promise.resolve({
          installUrl: gateway.installUrl(
            secrets.signState({ accountId, projectId: input.projectId }, now()),
          ),
        }),
      );
    },

    async triagePreview(accountId, rawInput) {
      const input = gitHubLinkInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "read", async (tx) => {
        await requireLink(tx, input.linkId);
        return {
          groups: groupTriageCandidates(
            (await tx.records(input.linkId))
              .filter((record) => record.lifecycle === "Active")
              .map(toExternalRecord),
          ),
          linkId: input.linkId,
          writesWork: false as const,
        };
      });
    },
  };

  return { ...base, ...workLinks, ...checkSummary, ...prContext };
}
