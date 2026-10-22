import { z } from "zod";

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
  { permission: "Pull requests", route: "GET /repos/{owner}/{repo}/pulls" },
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

export const gitHubRepositoryLinkSchema = z
  .object({
    accountLogin: z.string(),
    connection: z.enum(["Connected", "Disconnected"]),
    disconnectedAt: timestampSchema.nullable(),
    externalRecordCount: z.number().int().nonnegative(),
    htmlUrl: z.string().url(),
    id: z.string(),
    installationId: numericGitHubIdSchema,
    linkedAt: timestampSchema,
    name: z.string(),
    owner: z.string(),
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
    triage: z.enum(GITHUB_TRIAGE_STATES),
  })
  .strict();
export type GitHubRepositoryLink = z.infer<typeof gitHubRepositoryLinkSchema>;

export const GITHUB_RECORD_KINDS = ["Issue", "Pull request"] as const;
export const GITHUB_RECORD_STATES = ["open", "closed", "merged"] as const;

/** GitHub dış kaydı: only the data-minimized allow-list of fields (PRD 12). */
export const gitHubExternalRecordSchema = z
  .object({
    githubId: numericGitHubIdSchema,
    htmlUrl: z.string().url(),
    id: z.string(),
    kind: z.enum(GITHUB_RECORD_KINDS),
    labels: z.array(z.string()),
    linkId: z.string(),
    milestone: z.string().nullable(),
    number: numericGitHubIdSchema,
    projectId: z.string(),
    sourceState: z.enum(GITHUB_RECORD_STATES),
    sourceUpdatedAt: timestampSchema,
    title: z.string(),
  })
  .strict();
export type GitHubExternalRecord = z.infer<typeof gitHubExternalRecordSchema>;

/** What a gateway reports about one Issue or Pull request; no body, diff or payload. */
export interface GitHubIssueSnapshot {
  githubId: number;
  htmlUrl: string;
  kind: (typeof GITHUB_RECORD_KINDS)[number];
  labels: string[];
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
  getRepository: (
    token: string,
    repositoryId: number,
  ) => Promise<GitHubRepository | null>;
  installUrl: (state: string) => string;
  listInstallationRepositories: (token: string) => Promise<GitHubRepository[]>;
  listIssues: (
    token: string,
    repository: Pick<GitHubRepository, "name" | "owner">,
  ) => Promise<GitHubIssueSnapshot[]>;
  mintInstallationToken: (
    installationId: number,
  ) => Promise<GitHubInstallationToken | null>;
  /** Exact commit through the Git database endpoint: no tree, no patch. */
  resolveCommit: (
    token: string,
    repository: Pick<GitHubRepository, "name" | "owner">,
    sha: string,
  ) => Promise<{ sha: string; url: string } | null>;
}

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
  linkedAt: string;
  name: string;
  owner: string;
  projectId: string;
  repositoryId: number;
  stopReason: GitHubStopReason | null;
  triage: GitHubTriageState;
}

export interface GitHubStoredCredential {
  expiresAt: string;
  sealed: SealedSecret;
}

export interface GitHubIntegrationTransaction {
  /** Installation rows (any Project) that claim a GitHub installation id. */
  claimsOfInstallation: (installationId: number) => Promise<
    {
      connectedByAccountId: string;
      projectId: string;
    }[]
  >;
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
  nameHistory: (
    linkId: string,
  ) => Promise<{ name: string; observedAt: string; owner: string }[]>;
  readOnly: boolean;
  recordNameHistory: (
    linkId: string,
    entry: { name: string; observedAt: string; owner: string },
  ) => Promise<void>;
  records: (linkId?: string) => Promise<GitHubExternalRecord[]>;
  saveCredential: (
    installationRowId: string,
    credential: GitHubStoredCredential,
  ) => Promise<void>;
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
        | "name"
        | "owner"
        | "stopReason"
        | "triage"
      >
    >,
  ) => Promise<void>;
  /** Insert new records; an existing one changes only when the snapshot is not older. */
  upsertExternalRecords: (
    records: GitHubExternalRecordWrite[],
  ) => Promise<void>;
}

export interface GitHubExternalRecordWrite {
  id: string;
  linkId: string;
  projectId: string;
  snapshot: GitHubIssueSnapshot;
}

export interface GitHubIntegrationStore {
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
}

export interface GitHubIntegrationAccess {
  availableRepositories: (
    accountId: string,
    input: z.input<typeof gitHubAvailableRepositoriesInputSchema>,
  ) => Promise<z.output<typeof gitHubAvailableRepositoriesOutputSchema>>;
  completeInstall: (
    accountId: string,
    input: z.input<typeof gitHubInstallCompleteInputSchema>,
  ) => Promise<z.output<typeof gitHubInstallCompleteOutputSchema>>;
  disconnect: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<z.output<typeof gitHubDisconnectOutputSchema>>;
  linkRepository: (
    accountId: string,
    input: z.input<typeof gitHubLinkRepositoryInputSchema>,
  ) => Promise<GitHubRepositoryLink>;
  overview: (accountId: string, projectId: string) => Promise<GitHubOverview>;
  reconnect: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<GitHubRepositoryLink>;
  /** App uninstall as GitHub reports it: stops sync, touches no login or session. */
  recordInstallationRemoved: (installationId: number) => Promise<void>;
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
  triagePreview: (
    accountId: string,
    input: z.input<typeof gitHubLinkInputSchema>,
  ) => Promise<GitHubTriagePreview>;
}
