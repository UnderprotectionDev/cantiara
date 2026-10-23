import { z } from "zod";

import type {
  GitHubChecksOverview,
  GitHubObservedCheck,
  GitHubPullRequestChecksRead,
  GitHubStoredCheck,
  GitHubStoredPullHead,
  gitHubChecksInputSchema,
} from "./github-checks";
import type {
  GitHubPrContextOverview,
  GitHubPrContextWorkFacts,
  GitHubReviewerRead,
  gitHubPrContextInputSchema,
} from "./github-pr-context";
import type {
  GitHubWorkLinkAccess,
  GitHubWorkLinkTransaction,
} from "./github-work-links";

/**
 * GitHub Integration seam (spec 61, ticket 01: Repository link via GitHub App).
 *
 * A GitHub bağlantısı joins one Project to one GitHub repository by GitHub's
 * stable numeric repository id; owner and name are only the latest observed
 * labels. The GitHub App installation, not the Better Auth login OAuth, is the
 * repository authority: nothing here reads, creates or revokes a login, a
 * session or `Confirm GitHub Identity`. The App asks for the PRD read-only set
 * (ADR-0006) and every outbound call must pass the endpoint allow-list below.
 * The first triage previews GitHub dış kaydı candidates and never writes Work.
 */

const identifierSchema = z.string().trim().min(1).max(255);
const numericGitHubIdSchema = z.number().int().positive();
const timestampSchema = z.string().datetime({ offset: true });

// ---------------------------------------------------------------------------
// English UI labels (spec 61 Implementation Decisions).
// ---------------------------------------------------------------------------

export const GITHUB_AREA_LABEL = "GitHub";
export const GITHUB_APP_LABEL = "GitHub App";
export const GITHUB_REPOSITORY_LABEL = "Repository";
export const GITHUB_INSTALL_LABEL = "Install GitHub App";
export const GITHUB_RECONNECT_LABEL = "Reconnect";
export const GITHUB_DISCONNECT_LABEL = "Disconnect";
export const GITHUB_CONNECTED_LABEL = "Connected";
export const GITHUB_DISCONNECTED_LABEL = "Disconnected";
export const GITHUB_PAUSED_LABEL = "Paused";
export const GITHUB_SYNC_NOW_LABEL = "Sync now";
export const GITHUB_OUT_OF_DATE_LABEL = "Out of date";

/** Product cadence (PRD 12, PRD 15). */
export const GITHUB_RECONCILE_INTERVAL_MINUTES = 15;
export const GITHUB_OUT_OF_DATE_AFTER_MS = 30 * 60 * 1000;
export const GITHUB_FIRST_SYNC_BUDGET_MS = 30 * 60 * 1000;
export const GITHUB_WEBHOOK_SECRET_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
export const GITHUB_WEBHOOK_SECRET_OVERLAP_MS = 15 * 60 * 1000;
export const GITHUB_PAYLOAD_SUCCESS_RETENTION_MS = 24 * 60 * 60 * 1000;
export const GITHUB_PAYLOAD_FAILED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const GITHUB_DELIVERY_RESULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const GITHUB_TRIAGE_LABEL = "First triage";
export const GITHUB_SKIP_TRIAGE_LABEL = "Skip triage";
export const GITHUB_PERMISSIONS_LABEL = "GitHub App permissions";
export const GITHUB_CONTENTS_REASON_LABEL = "Why Contents: read";

// ---------------------------------------------------------------------------
// Permissions and the Contents allow-list (ADR-0006, PRD 12).
// ---------------------------------------------------------------------------

export const GITHUB_APP_PERMISSIONS = [
  { access: "read", permission: "Metadata" },
  { access: "read", permission: "Contents" },
  { access: "read", permission: "Issues" },
  { access: "read", permission: "Pull requests" },
  { access: "read", permission: "Checks" },
  { access: "read", permission: "Commit statuses" },
] as const;
export type GitHubAppPermission =
  (typeof GITHUB_APP_PERMISSIONS)[number]["permission"];

/** Shown to the founder before installing: why a read-only App asks for Contents. */
export const GITHUB_CONTENTS_REASON =
  "Contents: read is requested only to resolve a release, a tag or an exact commit through versioned endpoints. Cantiara never reads file contents, trees, blobs, archives, diffs or full check logs, and the App has no write permission.";

export const GITHUB_API_VERSION = "2022-11-28";

interface AllowedEndpoint {
  /** The permission that authorizes it, or `App` for the App's own JWT routes. */
  permission: GitHubAppPermission | "App";
  route: string;
}

/**
 * The only GitHub REST routes the integration may call. Everything else
 * (contents, git trees and blobs, tarball and zipball archives, compare diffs,
 * the full commit with its patch, job logs, every write) is refused.
 */
export const GITHUB_ALLOWED_ENDPOINTS: readonly AllowedEndpoint[] = [
  { permission: "App", route: "GET /app/installations/{installation_id}" },
  {
    permission: "App",
    route: "POST /app/installations/{installation_id}/access_tokens",
  },
  { permission: "Metadata", route: "GET /installation/repositories" },
  { permission: "Metadata", route: "GET /repositories/{repository_id}" },
  { permission: "Issues", route: "GET /repos/{owner}/{repo}/issues" },
  {
    permission: "Issues",
    route: "GET /repos/{owner}/{repo}/issues/{issue_number}",
  },
  { permission: "Pull requests", route: "GET /repos/{owner}/{repo}/pulls" },
  {
    permission: "Pull requests",
    route: "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
  },
  {
    permission: "Pull requests",
    route: "GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
  },
  {
    permission: "Checks",
    route: "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
  },
  {
    permission: "Commit statuses",
    route: "GET /repos/{owner}/{repo}/commits/{ref}/status",
  },
  {
    permission: "Contents",
    route: "GET /repos/{owner}/{repo}/releases/tags/{tag}",
  },
  {
    permission: "Contents",
    route: "GET /repos/{owner}/{repo}/git/ref/tags/{tag}",
  },
  {
    permission: "Contents",
    route: "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
  },
];

const WHITESPACE = /\s+/;
const QUERY_OR_FRAGMENT = /[?#]/;

function routePattern(route: string) {
  const [method, path] = route.split(" ");
  const source = (path ?? "")
    .split("/")
    .map((segment) =>
      segment.startsWith("{")
        ? "[^/?#]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return { method, pattern: new RegExp(`^${source}$`) };
}

const ALLOWED_PATTERNS = GITHUB_ALLOWED_ENDPOINTS.map((endpoint) => ({
  ...routePattern(endpoint.route),
  permission: endpoint.permission,
}));

/** The permission authorizing a `METHOD /path` request, or `null` when it is not allow-listed. */
export function gitHubRoutePermission(
  request: string,
): GitHubAppPermission | "App" | null {
  const [method, rawPath] = request.trim().split(WHITESPACE);
  const path = (rawPath ?? "").split(QUERY_OR_FRAGMENT)[0] ?? "";
  const match = ALLOWED_PATTERNS.find(
    (entry) =>
      entry.method === method?.toUpperCase() && entry.pattern.test(path),
  );
  return match?.permission ?? null;
}

export class GitHubEndpointRefusedError extends Error {
  readonly code = "GITHUB_ENDPOINT_REFUSED" as const;

  constructor(request: string) {
    super(`GitHub request is not on the allow-list: ${request}`);
    this.name = "GitHubEndpointRefusedError";
  }
}

export function assertGitHubRequestAllowed(request: string) {
  const permission = gitHubRoutePermission(request);
  if (!permission) {
    throw new GitHubEndpointRefusedError(request);
  }
  return permission;
}

// ---------------------------------------------------------------------------
// Records.
// ---------------------------------------------------------------------------

export const GITHUB_STOP_REASONS = [
  "App uninstalled",
  "Access revoked",
  "Repository not found",
] as const;
export type GitHubStopReason = (typeof GITHUB_STOP_REASONS)[number];

export const GITHUB_TRIAGE_STATES = ["Pending", "Skipped"] as const;
export type GitHubTriageState = (typeof GITHUB_TRIAGE_STATES)[number];

export const gitHubRepositorySchema = z
  .object({
    fullName: z.string(),
    htmlUrl: z.string().url(),
    name: z.string().min(1),
    owner: z.string().min(1),
    private: z.boolean(),
    repositoryId: numericGitHubIdSchema,
  })
  .strict();
export type GitHubRepository = z.infer<typeof gitHubRepositorySchema>;

export const gitHubInstallationSchema = z
  .object({
    accountLogin: z.string(),
    id: z.string(),
    installationId: numericGitHubIdSchema,
    removedAt: timestampSchema.nullable(),
  })
  .strict();
export type GitHubInstallationRecord = z.infer<typeof gitHubInstallationSchema>;

export const GITHUB_CONNECTIONS = [
  "Connected",
  "Paused",
  "Disconnected",
] as const;
export type GitHubConnection = (typeof GITHUB_CONNECTIONS)[number];

export const GITHUB_PAUSE_REASONS = ["Project archived"] as const;

/** What the founder sees about syncing: never silently "working" past the budgets. */
export const gitHubSyncStatusSchema = z
  .object({
    firstSyncOverdue: z.boolean(),
    lastError: z.string().nullable(),
    lastErrorAt: timestampSchema.nullable(),
    lastSuccessAt: timestampSchema.nullable(),
    outOfDate: z.boolean(),
    rateLimitedUntil: timestampSchema.nullable(),
  })
  .strict();
export type GitHubSyncStatus = z.infer<typeof gitHubSyncStatusSchema>;

export const gitHubRepositoryLinkSchema = z
  .object({
    accountLogin: z.string(),
    connection: z.enum(GITHUB_CONNECTIONS),
    disconnectedAt: timestampSchema.nullable(),
    externalRecordCount: z.number().int().nonnegative(),
    htmlUrl: z.string().url(),
    id: z.string(),
    installationId: numericGitHubIdSchema,
    linkedAt: timestampSchema,
    name: z.string(),
    owner: z.string(),
    pauseReason: z.enum(GITHUB_PAUSE_REASONS).nullable(),
    previousNames: z.array(
      z
        .object({
          name: z.string(),
          observedAt: timestampSchema,
          owner: z.string(),
        })
        .strict(),
    ),
    projectId: z.string(),
    repositoryId: numericGitHubIdSchema,
    stopReason: z.enum(GITHUB_STOP_REASONS).nullable(),
    sync: gitHubSyncStatusSchema,
    triage: z.enum(GITHUB_TRIAGE_STATES),
  })
  .strict();
export type GitHubRepositoryLink = z.infer<typeof gitHubRepositoryLinkSchema>;

export const GITHUB_RECORD_KINDS = ["Issue", "Pull request"] as const;
export const GITHUB_RECORD_STATES = ["open", "closed", "merged"] as const;
export const GITHUB_RECORD_LIFECYCLES = [
  "Active",
  "Archived",
  "Trash",
] as const;

/** GitHub dış kaydı: only the data-minimized allow-list of fields (PRD 12). */
export const gitHubExternalRecordSchema = z
  .object({
    githubId: numericGitHubIdSchema,
    htmlUrl: z.string().url(),
    id: z.string(),
    kind: z.enum(GITHUB_RECORD_KINDS),
    labels: z.array(z.string()),
    /** Local life is independent of GitHub: Archive keeps updating, Trash does not. */
    lifecycle: z.enum(GITHUB_RECORD_LIFECYCLES),
    linkId: z.string(),
    milestone: z.string().nullable(),
    /** Restored from Trash: the missed source state waits for an explicit Sync now. */
    needsReconcile: z.boolean(),
    number: numericGitHubIdSchema,
    /** Visible origin of a re-included record: the permanently deleted identity. */
    origin: z
      .object({ deletedAt: timestampSchema, recordId: z.string() })
      .strict()
      .nullable(),
    projectId: z.string(),
    sourceState: z.enum(GITHUB_RECORD_STATES),
    sourceUpdatedAt: timestampSchema,
    title: z.string(),
  })
  .strict();
export type GitHubExternalRecord = z.infer<typeof gitHubExternalRecordSchema>;

/** The row as stores keep it: the record plus where its last state came from. */
export type GitHubStoredRecord = GitHubExternalRecord & {
  appliedFrom: "reconcile" | "webhook";
};

/**
 * Text read only to find Work keys while a record is applied (branch name,
 * description). It is never stored: the allow-list has no body or free text.
 */
export interface GitHubKeyMatchText {
  body: string | null;
  headBranch: string | null;
}

/** What a gateway reports about one Issue or Pull request; no body, diff or payload is kept. */
export interface GitHubIssueSnapshot {
  githubId: number;
  /** Transient: the Pull request head SHA a payload carried; kept in the head table, never on the record. */
  headSha?: string | null;
  htmlUrl: string;
  kind: (typeof GITHUB_RECORD_KINDS)[number];
  labels: string[];
  /** Transient; the integration reads it for key matching and drops it before any write. */
  matchText?: GitHubKeyMatchText;
  milestone: string | null;
  number: number;
  sourceState: (typeof GITHUB_RECORD_STATES)[number];
  sourceUpdatedAt: string;
  title: string;
}

export interface GitHubTriageGroup {
  key: string;
  label: string;
  records: GitHubExternalRecord[];
}

export const gitHubTriagePreviewSchema = z
  .object({
    groups: z.array(
      z
        .object({
          key: z.string(),
          label: z.string(),
          records: z.array(gitHubExternalRecordSchema),
        })
        .strict(),
    ),
    linkId: z.string(),
    /** Triage never writes Work; confirmed conversion is a later, explicit step. */
    writesWork: z.literal(false),
  })
  .strict();
export type GitHubTriagePreview = z.infer<typeof gitHubTriagePreviewSchema>;

/**
 * Explainable grouping only (PRD 12): open or closed state and milestone, newest
 * update first. No AI, no ranking, no Work status.
 */
export function groupTriageCandidates(
  records: GitHubExternalRecord[],
): GitHubTriageGroup[] {
  const groups = new Map<string, GitHubTriageGroup>();
  const sorted = records
    .filter((record) => record.kind === "Issue")
    .sort((a, b) => b.sourceUpdatedAt.localeCompare(a.sourceUpdatedAt));
  for (const record of sorted) {
    const closed = record.sourceState !== "open";
    const key = closed ? "closed" : `open:${record.milestone ?? ""}`;
    let label = "Closed";
    if (!closed) {
      label = record.milestone
        ? `Open, milestone ${record.milestone}`
        : "Open, no milestone";
    }
    const group = groups.get(key) ?? { key, label, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.key === "closed") - Number(b.key === "closed"),
  );
}

// ---------------------------------------------------------------------------
// Inputs and outputs.
// ---------------------------------------------------------------------------

export const gitHubProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const gitHubInstallStartInputSchema = gitHubProjectInputSchema;

export const gitHubInstallCompleteInputSchema = z
  .object({
    installationId: numericGitHubIdSchema,
    state: z.string().min(1).max(2000),
  })
  .strict();

export const gitHubAvailableRepositoriesInputSchema = z
  .object({
    installationId: numericGitHubIdSchema,
    projectId: identifierSchema,
  })
  .strict();

export const gitHubLinkRepositoryInputSchema = z
  .object({
    installationId: numericGitHubIdSchema,
    projectId: identifierSchema,
    repositoryId: numericGitHubIdSchema,
  })
  .strict();

export const gitHubLinkInputSchema = z
  .object({ linkId: identifierSchema, projectId: identifierSchema })
  .strict();

export const gitHubRecordInputSchema = z
  .object({ projectId: identifierSchema, recordId: identifierSchema })
  .strict();

export const gitHubReincludeInputSchema = z
  .object({
    githubId: numericGitHubIdSchema,
    kind: z.enum(GITHUB_RECORD_KINDS),
    linkId: identifierSchema,
    projectId: identifierSchema,
  })
  .strict();

export const gitHubSearchRecordsInputSchema = z
  .object({
    projectId: identifierSchema,
    query: z.string().trim().max(200).default(""),
  })
  .strict();

export const gitHubOverviewSchema = z
  .object({
    app: z
      .object({
        configured: z.boolean(),
        contentsReason: z.string(),
        permissions: z.array(
          z
            .object({ access: z.literal("read"), permission: z.string() })
            .strict(),
        ),
      })
      .strict(),
    installations: z.array(gitHubInstallationSchema),
    links: z.array(gitHubRepositoryLinkSchema),
    projectId: z.string(),
    readOnly: z.boolean(),
  })
  .strict();
export type GitHubOverview = z.infer<typeof gitHubOverviewSchema>;

export const gitHubInstallStartOutputSchema = z
  .object({ installUrl: z.string().url() })
  .strict();

export const gitHubInstallCompleteOutputSchema = z
  .object({
    installation: gitHubInstallationSchema,
    projectId: z.string(),
    repositories: z.array(gitHubRepositorySchema),
  })
  .strict();

export const gitHubAvailableRepositoriesOutputSchema = z
  .object({
    repositories: z.array(
      gitHubRepositorySchema.extend({ linked: z.boolean() }).strict(),
    ),
  })
  .strict();

export const gitHubSearchRecordsOutputSchema = z
  .object({ records: z.array(gitHubExternalRecordSchema) })
  .strict();

/** Applied source change shown after an explicit reconcile of a restored record. */
export const gitHubRestoredDiffSchema = z
  .object({
    from: z
      .object({ sourceState: z.enum(GITHUB_RECORD_STATES), title: z.string() })
      .strict(),
    recordId: z.string(),
    to: z
      .object({ sourceState: z.enum(GITHUB_RECORD_STATES), title: z.string() })
      .strict(),
  })
  .strict();

export const gitHubSyncNowOutputSchema = z
  .object({
    applied: z.number().int().nonnegative(),
    link: gitHubRepositoryLinkSchema,
    /** `ran`, or why nothing was read: the founder never sees a silent no-op. */
    outcome: z.enum([
      "ran",
      "paused",
      "disconnected",
      "rate-limited",
      "failed",
    ]),
    restoredDiffs: z.array(gitHubRestoredDiffSchema),
    stale: z.number().int().nonnegative(),
  })
  .strict();

/** What Reconnect or Disconnect touches, shown before the founder confirms. */
export const gitHubLinkPreviewSchema = z
  .object({
    action: z.enum(["Reconnect", "Disconnect"]),
    affected: z
      .object({
        issues: z.number().int().nonnegative(),
        pullRequests: z.number().int().nonnegative(),
        repository: z.string(),
      })
      .strict(),
    /** Plain statements of what the action does and does not do. */
    effects: z.array(z.string()),
    link: gitHubRepositoryLinkSchema,
  })
  .strict();
export type GitHubLinkPreview = z.infer<typeof gitHubLinkPreviewSchema>;

export const gitHubDisconnectOutputSchema = z
  .object({
    /** Captured records stay as historical sources; Disconnect deletes none. */
    keptExternalRecords: z.number().int().nonnegative(),
    link: gitHubRepositoryLinkSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// Ports.
// ---------------------------------------------------------------------------

/** Envelope-sealed secret as stored: never plaintext (tech-stack envelope encryption). */
export interface SealedSecret {
  ciphertext: string;
  keyVersion: number;
  wrappedDataKey: string;
}

export interface GitHubInstallationToken {
  expiresAt: string;
  token: string;
}

export interface GitHubInstallationDescription {
  accountLogin: string;
  /** When GitHub created the installation; `null` when the payload carries none. */
  createdAt: string | null;
  installationId: number;
}

/**
 * The GitHub App as the integration sees it. The real adapter (Octokit) and the
 * test double both sit behind the endpoint allow-list; no method reads file
 * contents, trees, blobs, archives, diffs or full logs.
 */
export interface GitHubAppGateway {
  describeInstallation: (
    installationId: number,
  ) => Promise<GitHubInstallationDescription | null>;
  /** One Issue or Pull request by number; `null` when GitHub no longer shows it. */
  getIssue: (
    token: string,
    repository: Pick<GitHubRepository, "name" | "owner">,
    number: number,
  ) => Promise<GitHubIssueSnapshot | null>;
  getRepository: (
    token: string,
    repositoryId: number,
  ) => Promise<GitHubRepository | null>;
  installUrl: (state: string) => string;
  listInstallationRepositories: (token: string) => Promise<GitHubRepository[]>;
  /** `since` makes the read incremental: only records GitHub updated after it. */
  listIssues: (
    token: string,
    repository: Pick<GitHubRepository, "name" | "owner">,
    options?: { since?: string },
  ) => Promise<GitHubIssueSnapshot[]>;
  /**
   * Open Pull requests with their current head SHA and the checks GitHub
   * reports on it (Pull requests, Checks and Commit statuses read; no log).
   */
  listPullRequestChecks: (
    token: string,
    repository: Pick<GitHubRepository, "name" | "owner">,
  ) => Promise<GitHubPullRequestChecksRead[]>;
  /**
   * Requested reviewers and submitted reviews of one Pull request (reviews and
   * requested reviewers, read only; no diff, comment body or write).
   */
  listPullRequestReviewers: (
    token: string,
    repository: Pick<GitHubRepository, "name" | "owner">,
    number: number,
  ) => Promise<GitHubReviewerRead>;
  mintInstallationToken: (
    installationId: number,
  ) => Promise<GitHubInstallationToken | null>;
  /** Why a stable repository id is unreadable: gone, or access withdrawn. */
  probeRepository: (
    token: string,
    repositoryId: number,
  ) => Promise<
    | { repository: GitHubRepository; status: "ok" }
    | { status: "forbidden" }
    | { status: "not-found" }
  >;
  /** Exact commit through the Git database endpoint: no tree, no patch. */
  resolveCommit: (
    token: string,
    repository: Pick<GitHubRepository, "name" | "owner">,
    sha: string,
  ) => Promise<{ sha: string; url: string } | null>;
}

/** The allow-listed part of a webhook payload the worker applies. */
export type GitHubWebhookEvent =
  | { installationId: number; kind: "installation-removed" }
  | {
      installationId: number;
      kind: "repository-access-removed";
      repositoryId: number;
    }
  | {
      installationId: number;
      kind: "repository-missing";
      repositoryId: number;
    }
  | {
      installationId: number;
      kind: "repository-renamed";
      repository: GitHubRepository;
    }
  | {
      installationId: number;
      kind: "record";
      repositoryId: number;
      snapshot: GitHubIssueSnapshot;
    }
  | {
      check: GitHubObservedCheck;
      headSha: string;
      installationId: number;
      kind: "check";
      /** Pull request numbers the payload named; empty for a bare commit status. */
      pullRequestNumbers: number[];
      repositoryId: number;
    };

export interface GitHubStoredInstallation {
  accountLogin: string;
  connectedByAccountId: string;
  createdAt: string;
  id: string;
  installationId: number;
  projectId: string;
  removedAt: string | null;
}

export interface GitHubStoredLink {
  disconnectedAt: string | null;
  htmlUrl: string;
  id: string;
  installationRowId: string;
  lastError: string | null;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
  linkedAt: string;
  name: string;
  owner: string;
  pausedAt: string | null;
  projectId: string;
  rateLimitedUntil: string | null;
  repositoryId: number;
  stopReason: GitHubStopReason | null;
  syncCursor: string | null;
  triage: GitHubTriageState;
}

export type GitHubRecordWriteResult =
  | "applied"
  | "awaiting-reconcile"
  | "stale"
  | "tombstoned"
  | "trashed";

export interface GitHubRecordWriteOutcome {
  /** Equal `updated_at` with different content: the reconcile snapshot won; history records it. */
  conflict: boolean;
  githubId: number;
  kind: GitHubExternalRecord["kind"];
  recordId: string | null;
  /** The visible state replaced, when a restored record was reconciled. */
  replaced: {
    sourceState: GitHubExternalRecord["sourceState"];
    title: string;
  } | null;
  result: GitHubRecordWriteResult;
}

export interface GitHubWriteOptions {
  /** An explicit Sync now: the only path that applies a restored record's missed state. */
  explicit: boolean;
  origin: "reconcile" | "webhook";
}

export interface GitHubLinkHistoryEntry {
  at: string;
  detail: string;
  kind: string;
}

export interface GitHubStoredCredential {
  expiresAt: string;
  sealed: SealedSecret;
}

export interface GitHubIntegrationTransaction
  extends GitHubWorkLinkTransaction {
  appendHistory: (
    linkId: string,
    entry: GitHubLinkHistoryEntry,
  ) => Promise<void>;
  /** Stored checks of this seam (PR check summary); never a Test Session row. */
  checks: () => Promise<GitHubStoredCheck[]>;
  /** Installation rows (any Project) that claim a GitHub installation id. */
  claimsOfInstallation: (installationId: number) => Promise<
    {
      connectedByAccountId: string;
      projectId: string;
    }[]
  >;
  /** The Active/Archived/Trash row count of one link (overview). */
  countRecords: (linkId: string) => Promise<number>;
  deleteCredential: (installationRowId: string) => Promise<void>;
  /** Permanent delete: removes the record and leaves a content-free tombstone. */
  deleteRecordWithTombstone: (recordId: string, at: string) => Promise<void>;
  history: (linkId: string) => Promise<GitHubLinkHistoryEntry[]>;
  insertInstallation: (row: GitHubStoredInstallation) => Promise<void>;
  insertLink: (row: GitHubStoredLink) => Promise<void>;
  installationByGitHubId: (
    installationId: number,
  ) => Promise<GitHubStoredInstallation | null>;
  installations: () => Promise<GitHubStoredInstallation[]>;
  linkById: (id: string) => Promise<GitHubStoredLink | null>;
  linkByRepositoryId: (
    repositoryId: number,
  ) => Promise<GitHubStoredLink | null>;
  links: () => Promise<GitHubStoredLink[]>;
  loadCredential: (
    installationRowId: string,
  ) => Promise<GitHubStoredCredential | null>;
  /**
   * Serializes the claim of one GitHub installation id across Projects and
   * accounts until the unit of work ends, so two accounts cannot complete the
   * same installation concurrently.
   */
  lockInstallationClaim: (installationId: number) => Promise<void>;
  nameHistory: (
    linkId: string,
  ) => Promise<{ name: string; observedAt: string; owner: string }[]>;
  /**
   * Read-only facts the PR Context Card derives from owner records (Work text,
   * Karar, Risk, Feedback, Proje Surumu). Nothing here can write them.
   */
  prContextFacts: (workIds: string[]) => Promise<GitHubPrContextWorkFacts[]>;
  /** Drops the checks of a Pull request that belong to another head SHA. */
  pruneSupersededChecks: (recordId: string, headSha: string) => Promise<void>;
  pullHeads: () => Promise<GitHubStoredPullHead[]>;
  readOnly: boolean;
  recordById: (recordId: string) => Promise<GitHubStoredRecord | null>;
  /**
   * One record of this link by its stored kind and GitHub number (the Pull
   * request identity translation: GitHub names a PR with two id sequences).
   */
  recordByNumber: (
    linkId: string,
    kind: GitHubExternalRecord["kind"],
    number: number,
  ) => Promise<GitHubStoredRecord | null>;
  recordNameHistory: (
    linkId: string,
    entry: { name: string; observedAt: string; owner: string },
  ) => Promise<void>;
  records: (linkId?: string) => Promise<GitHubStoredRecord[]>;
  /** Records keyed by id within the unit of work (batched head observation). */
  recordsByIds: (ids: string[]) => Promise<GitHubStoredRecord[]>;
  /** Explicit re-include: a new product identity carrying the deleted one as visible origin. */
  reincludeRecord: (
    write: GitHubExternalRecordWrite,
  ) => Promise<GitHubStoredRecord>;
  saveCredential: (
    installationRowId: string,
    credential: GitHubStoredCredential,
  ) => Promise<void>;
  /**
   * Active records of the whole Project whose title, number, milestone or
   * labels contain the needle, newest first (search never loads missed data).
   */
  searchActiveRecords: (
    needle: string,
    limit: number,
  ) => Promise<GitHubStoredRecord[]>;
  setPullHead: (head: GitHubStoredPullHead) => Promise<void>;
  setRecordLifecycle: (
    recordId: string,
    patch: {
      archivedAt?: string | null;
      needsReconcile?: boolean;
      trashedAt?: string | null;
    },
  ) => Promise<void>;
  tombstone: (
    linkId: string,
    kind: GitHubExternalRecord["kind"],
    githubId: number,
  ) => Promise<{ deletedAt: string; number: number; recordId: string } | null>;
  updateInstallation: (
    id: string,
    patch: Partial<Pick<GitHubStoredInstallation, "removedAt">>,
  ) => Promise<void>;
  updateLink: (
    id: string,
    patch: Partial<
      Pick<
        GitHubStoredLink,
        | "disconnectedAt"
        | "htmlUrl"
        | "installationRowId"
        | "lastError"
        | "lastErrorAt"
        | "lastSuccessAt"
        | "name"
        | "owner"
        | "pausedAt"
        | "rateLimitedUntil"
        | "stopReason"
        | "syncCursor"
        | "triage"
      >
    >,
  ) => Promise<void>;
  upsertChecks: (rows: GitHubStoredCheck[]) => Promise<void>;
  /**
   * Applies source snapshots by GitHub id and `updated_at`: an older one never
   * rewinds, an equal one prefers the reconcile snapshot, a tombstoned source is
   * never recreated, a trashed record takes no write and a restored one waits
   * for an explicit reconcile.
   */
  upsertExternalRecords: (
    records: GitHubExternalRecordWrite[],
    options: GitHubWriteOptions,
  ) => Promise<GitHubRecordWriteOutcome[]>;
}

export interface GitHubExternalRecordWrite {
  id: string;
  linkId: string;
  origin?: { deletedAt: string; recordId: string };
  projectId: string;
  snapshot: GitHubIssueSnapshot;
}

export interface GitHubIntegrationStore {
  /** Every link with the Project it belongs to, for the scheduled reconcile. */
  linkScopes: () => Promise<{ linkId: string; projectId: string }[]>;
  run: <T>(
    accountId: string,
    projectId: string,
    mode: "read" | "write",
    work: (transaction: GitHubIntegrationTransaction) => Promise<T>,
  ) => Promise<T | null>;
  /** Webhook-side effect with no signed-in account: runs once per Project holding the installation. */
  runForInstallation: (
    installationId: number,
    work: (
      transaction: GitHubIntegrationTransaction,
      projectId: string,
    ) => Promise<void>,
  ) => Promise<void>;
  /** System-side unit of work for one Project (worker, webhook); `null` when it is gone. */
  runForProject: <T>(
    projectId: string,
    work: (transaction: GitHubIntegrationTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

export interface GitHubIntegrationAccess extends GitHubWorkLinkAccess {
  /**
   * Applies one verified webhook event (already in the durable inbox). Returns
   * a short result stored with the delivery; throws so the worker retries.
   */
  applyWebhookEvent: (event: GitHubWebhookEvent) => Promise<string>;
  /** Local Archive of one GitHub dış kaydı: updates from GitHub continue. */
  archiveRecord: (
    accountId: string,
    input: z.input<typeof gitHubRecordInputSchema>,
  ) => Promise<GitHubExternalRecord>;
  availableRepositories: (
    accountId: string,
    input: z.input<typeof gitHubAvailableRepositoriesInputSchema>,
  ) => Promise<z.output<typeof gitHubAvailableRepositoriesOutputSchema>>;
  /** Read-only PR check summary on the current head SHA (never a Test Session). */
  checks: (
    accountId: string,
    input: z.input<typeof gitHubChecksInputSchema>,
  ) => Promise<GitHubChecksOverview>;
  completeInstall: (
    accountId: string,
    input: z.input<typeof gitHubInstallCompleteInputSchema>,
  ) => Promise<z.output<typeof gitHubInstallCompleteOutputSchema>>;
  deleteRecordPermanently: (
    accountId: string,
    input: z.input<typeof gitHubRecordInputSchema>,
  ) => Promise<void>;
  disconnect: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<z.output<typeof gitHubDisconnectOutputSchema>>;
  linkRepository: (
    accountId: string,
    input: z.input<typeof gitHubLinkRepositoryInputSchema>,
  ) => Promise<GitHubRepositoryLink>;
  overview: (accountId: string, projectId: string) => Promise<GitHubOverview>;
  /**
   * Read-only PR Context Card of each linked Pull request, derived live from
   * owner records. It has no review, approve, merge or close-Work command.
   */
  prContext: (
    accountId: string,
    input: z.input<typeof gitHubPrContextInputSchema>,
  ) => Promise<GitHubPrContextOverview>;
  previewDisconnect: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<GitHubLinkPreview>;
  previewReconnect: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<GitHubLinkPreview>;
  /** Scheduled incremental read-only reconcile of every active link (<= 15 min). */
  reconcileDue: () => Promise<{ failed: number; ran: number; skipped: number }>;
  reconnect: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<GitHubRepositoryLink>;
  /** App uninstall as GitHub reports it: stops sync, touches no login or session. */
  recordInstallationRemoved: (installationId: number) => Promise<void>;
  reincludeRecord: (
    accountId: string,
    input: z.input<typeof gitHubReincludeInputSchema>,
  ) => Promise<GitHubExternalRecord>;
  restoreRecord: (
    accountId: string,
    input: z.input<typeof gitHubRecordInputSchema>,
  ) => Promise<GitHubExternalRecord>;
  searchRecords: (
    accountId: string,
    input: z.input<typeof gitHubSearchRecordsInputSchema>,
  ) => Promise<z.output<typeof gitHubSearchRecordsOutputSchema>>;
  skipTriage: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<GitHubRepositoryLink>;
  startInstall: (
    accountId: string,
    input: z.input<typeof gitHubInstallStartInputSchema>,
  ) => Promise<z.output<typeof gitHubInstallStartOutputSchema>>;
  syncNow: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<z.output<typeof gitHubSyncNowOutputSchema>>;
  trashRecord: (
    accountId: string,
    input: z.input<typeof gitHubRecordInputSchema>,
  ) => Promise<GitHubExternalRecord>;
  triagePreview: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<GitHubTriagePreview>;
}
