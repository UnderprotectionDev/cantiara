import {
  assertGitHubRequestAllowed,
  type GitHubAppGateway,
  type GitHubIssueSnapshot,
  type GitHubRepository,
} from "@cantiara/api/github-integration";

/**
 * The GitHub App gateway over a transport port. Every request is checked
 * against the ADR-0006 endpoint allow-list before it reaches the transport, so
 * a tree, blob, archive, diff, file-content, full-log or write route cannot be
 * sent whichever adapter (Octokit or the test double) sits below.
 */

export type GitHubAuth =
  | { kind: "app" }
  | { kind: "installation"; token: string };

export interface GitHubCall {
  auth: GitHubAuth;
  params: Record<string, unknown>;
  /** `METHOD /path/{template}` in Octokit route form. */
  route: string;
}

export class GitHubRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`GitHub responded with ${status}.`);
    this.name = "GitHubRequestError";
    this.status = status;
  }
}

export interface GitHubTransport {
  request: (call: GitHubCall) => Promise<unknown>;
}

export function createAllowListedTransport(
  transport: GitHubTransport,
): GitHubTransport {
  return {
    request(call) {
      assertGitHubRequestAllowed(call.route);
      return transport.request(call);
    },
  };
}

interface RawRepository {
  full_name?: string;
  html_url?: string;
  id: number;
  name: string;
  owner?: { login?: string };
  private?: boolean;
}

interface RawIssue {
  html_url: string;
  id: number;
  labels?: (string | { name?: string })[];
  merged_at?: string | null;
  milestone?: { title?: string } | null;
  number: number;
  pull_request?: { merged_at?: string | null };
  state: string;
  title: string;
  updated_at: string;
}

function toRepository(raw: RawRepository): GitHubRepository {
  const owner = raw.owner?.login ?? raw.full_name?.split("/")[0] ?? "";
  return {
    fullName: raw.full_name ?? `${owner}/${raw.name}`,
    htmlUrl: raw.html_url ?? `https://github.com/${owner}/${raw.name}`,
    name: raw.name,
    owner,
    private: Boolean(raw.private),
    repositoryId: raw.id,
  };
}

function toSnapshot(raw: RawIssue): GitHubIssueSnapshot {
  const isPullRequest = Boolean(raw.pull_request);
  const merged = Boolean(raw.pull_request?.merged_at ?? raw.merged_at);
  let sourceState: GitHubIssueSnapshot["sourceState"] = "open";
  if (raw.state !== "open") {
    sourceState = merged ? "merged" : "closed";
  }
  return {
    githubId: raw.id,
    htmlUrl: raw.html_url,
    kind: isPullRequest ? "Pull request" : "Issue",
    labels: (raw.labels ?? [])
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter(Boolean),
    milestone: raw.milestone?.title ?? null,
    number: raw.number,
    sourceState,
    sourceUpdatedAt: new Date(raw.updated_at).toISOString(),
    title: raw.title,
  };
}

async function orNotFound<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (
      error instanceof GitHubRequestError &&
      [401, 403, 404].includes(error.status)
    ) {
      return null;
    }
    throw error;
  }
}

/** Issues listed for one triage pass: a single newest-first page, never a full crawl. */
const TRIAGE_PAGE_SIZE = 100;

export function createGitHubAppGateway(options: {
  appSlug: string;
  transport: GitHubTransport;
}): GitHubAppGateway {
  const transport = createAllowListedTransport(options.transport);
  const app: GitHubAuth = { kind: "app" };
  const asInstallation = (token: string): GitHubAuth => ({
    kind: "installation",
    token,
  });

  return {
    async describeInstallation(installationId) {
      const raw = await orNotFound(
        () =>
          transport.request({
            auth: app,
            params: { installation_id: installationId },
            route: "GET /app/installations/{installation_id}",
          }) as Promise<{ account?: { login?: string } }>,
      );
      return raw
        ? { accountLogin: raw.account?.login ?? "", installationId }
        : null;
    },

    async getRepository(token, repositoryId) {
      const raw = await orNotFound(
        () =>
          transport.request({
            auth: asInstallation(token),
            params: { repository_id: repositoryId },
            route: "GET /repositories/{repository_id}",
          }) as Promise<RawRepository>,
      );
      return raw ? toRepository(raw) : null;
    },

    installUrl(state) {
      const url = new URL(
        `https://github.com/apps/${encodeURIComponent(options.appSlug)}/installations/new`,
      );
      url.searchParams.set("state", state);
      return url.toString();
    },

    async listInstallationRepositories(token) {
      const raw = (await transport.request({
        auth: asInstallation(token),
        params: { per_page: 100 },
        route: "GET /installation/repositories",
      })) as { repositories?: RawRepository[] };
      return (raw.repositories ?? []).map(toRepository);
    },

    async listIssues(token, repository) {
      const raw = (await transport.request({
        auth: asInstallation(token),
        params: {
          direction: "desc",
          owner: repository.owner,
          per_page: TRIAGE_PAGE_SIZE,
          repo: repository.name,
          sort: "updated",
          state: "all",
        },
        route: "GET /repos/{owner}/{repo}/issues",
      })) as RawIssue[];
      return raw.map(toSnapshot);
    },

    async mintInstallationToken(installationId) {
      const raw = await orNotFound(
        () =>
          transport.request({
            auth: app,
            params: { installation_id: installationId },
            route: "POST /app/installations/{installation_id}/access_tokens",
          }) as Promise<{ expires_at: string; token: string }>,
      );
      return raw
        ? {
            expiresAt: new Date(raw.expires_at).toISOString(),
            token: raw.token,
          }
        : null;
    },

    async resolveCommit(token, repository, sha) {
      const raw = await orNotFound(
        () =>
          transport.request({
            auth: asInstallation(token),
            params: {
              commit_sha: sha,
              owner: repository.owner,
              repo: repository.name,
            },
            route: "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          }) as Promise<{ html_url?: string; sha: string }>,
      );
      return raw ? { sha: raw.sha, url: raw.html_url ?? "" } : null;
    },
  };
}
