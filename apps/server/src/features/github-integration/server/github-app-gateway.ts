import type { GitHubPullRequestChecksRead } from "@cantiara/api/github-checks";
import {
  assertGitHubRequestAllowed,
  type GitHubAppGateway,
  type GitHubIssueSnapshot,
  type GitHubRepository,
} from "@cantiara/api/github-integration";

import {
  type RawCheckRun,
  type RawCommitStatus,
  toObservedCheckRun,
  toObservedStatus,
} from "./github-check-mapping";

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
  /** Seconds GitHub asked us to wait (`Retry-After` or the rate-limit reset). */
  readonly retryAfterSeconds: number | undefined;
  readonly status: number;

  constructor(status: number, retryAfterSeconds?: number) {
    super(`GitHub responded with ${status}.`);
    this.name = "GitHubRequestError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

/** GitHub rate-limited the read: the integration waits instead of polling. */
export class GitHubRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`GitHub rate limit: retry after ${retryAfterSeconds}s.`);
    this.name = "GitHubRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const DEFAULT_RETRY_AFTER_SECONDS = 60;

export interface GitHubTransport {
  request: (call: GitHubCall) => Promise<unknown>;
}

export function createAllowListedTransport(
  transport: GitHubTransport,
): GitHubTransport {
  return {
    async request(call) {
      assertGitHubRequestAllowed(call.route);
      try {
        return await transport.request(call);
      } catch (error) {
        if (
          error instanceof GitHubRequestError &&
          (error.status === 429 ||
            (error.status === 403 && error.retryAfterSeconds !== undefined))
        ) {
          // biome-ignore lint/style/useErrorCause: The transport error is reduced to the wait GitHub asked for.
          throw new GitHubRateLimitedError(
            error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
          );
        }
        throw error;
      }
    },
  };
}

export interface RawRepository {
  full_name?: string;
  html_url?: string;
  id: number;
  name: string;
  owner?: { login?: string };
  private?: boolean;
}

export interface RawIssue {
  body?: string | null;
  head?: { ref?: string | null; sha?: string | null } | null;
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

export function toRepository(raw: RawRepository): GitHubRepository {
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

export function toSnapshot(raw: RawIssue): GitHubIssueSnapshot {
  const isPullRequest = Boolean(raw.pull_request);
  const merged = Boolean(raw.pull_request?.merged_at ?? raw.merged_at);
  let sourceState: GitHubIssueSnapshot["sourceState"] = "open";
  if (raw.state !== "open") {
    sourceState = merged ? "merged" : "closed";
  }
  return {
    githubId: raw.id,
    headSha: isPullRequest ? (raw.head?.sha ?? null) : null,
    htmlUrl: raw.html_url,
    kind: isPullRequest ? "Pull request" : "Issue",
    labels: (raw.labels ?? [])
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter(Boolean),
    // Read for Work key matching only; the integration drops it before any write.
    matchText: { body: raw.body ?? null, headBranch: raw.head?.ref ?? null },
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

/** Newest-first pages of at most 100; a read stops after `MAX_PAGES` and the next one continues. */
const TRIAGE_PAGE_SIZE = 100;
const MAX_PAGES = 10;
/** Open Pull requests whose checks one reconcile reads; the next one continues. */
const MAX_CHECKED_PULL_REQUESTS = 50;

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

    async getIssue(token, repository, number) {
      const raw = await orNotFound(
        () =>
          transport.request({
            auth: asInstallation(token),
            params: {
              issue_number: number,
              owner: repository.owner,
              repo: repository.name,
            },
            route: "GET /repos/{owner}/{repo}/issues/{issue_number}",
          }) as Promise<RawIssue>,
      );
      return raw ? toSnapshot(raw) : null;
    },

    async listIssues(token, repository, readOptions) {
      const snapshots: GitHubIssueSnapshot[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: Pages are read in order; a short page ends the loop.
        const raw = (await transport.request({
          auth: asInstallation(token),
          params: {
            direction: "desc",
            owner: repository.owner,
            page,
            per_page: TRIAGE_PAGE_SIZE,
            repo: repository.name,
            sort: "updated",
            state: "all",
            ...(readOptions?.since ? { since: readOptions.since } : {}),
          },
          route: "GET /repos/{owner}/{repo}/issues",
        })) as RawIssue[];
        snapshots.push(...raw.map(toSnapshot));
        if (raw.length < TRIAGE_PAGE_SIZE) {
          break;
        }
      }
      return snapshots;
    },

    async listPullRequestChecks(token, repository) {
      const auth = asInstallation(token);
      // A missing Checks or Commit statuses grant reads as no checks, not a failed sync.
      const pulls =
        (await orNotFound(
          () =>
            transport.request({
              auth,
              params: {
                owner: repository.owner,
                per_page: MAX_CHECKED_PULL_REQUESTS,
                repo: repository.name,
                state: "open",
              },
              route: "GET /repos/{owner}/{repo}/pulls",
            }) as Promise<{ head?: { sha?: string }; number: number }[]>,
        )) ?? [];
      const reads: GitHubPullRequestChecksRead[] = [];
      for (const pull of pulls) {
        const headSha = pull.head?.sha;
        if (!headSha) {
          continue;
        }
        const params = {
          owner: repository.owner,
          per_page: 100,
          ref: headSha,
          repo: repository.name,
        };
        // biome-ignore lint/performance/noAwaitInLoops: One open Pull request is read at a time to stay inside GitHub's rate limit.
        const runs = await orNotFound(
          () =>
            transport.request({
              auth,
              params,
              route: "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
            }) as Promise<{ check_runs?: RawCheckRun[] }>,
        );
        const statuses = await orNotFound(
          () =>
            transport.request({
              auth,
              params,
              route: "GET /repos/{owner}/{repo}/commits/{ref}/status",
            }) as Promise<{ statuses?: RawCommitStatus[] }>,
        );
        reads.push({
          checks: [
            ...(runs?.check_runs ?? []).map(toObservedCheckRun),
            ...(statuses?.statuses ?? []).map(toObservedStatus),
          ],
          headSha,
          number: pull.number,
        });
      }
      return reads;
    },

    async listPullRequestReviewers(token, repository, number) {
      const auth = asInstallation(token);
      const params = {
        owner: repository.owner,
        per_page: 100,
        pull_number: number,
        repo: repository.name,
      };
      // A missing Pull requests grant reads as no reviewer data, not a failure.
      const [reviews, requested] = await Promise.all([
        orNotFound(
          () =>
            transport.request({
              auth,
              params,
              route: "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
            }) as Promise<
              {
                html_url?: string;
                state?: string;
                submitted_at?: string | null;
                user?: { login?: string } | null;
              }[]
            >,
        ),
        orNotFound(
          () =>
            transport.request({
              auth,
              params,
              route:
                "GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
            }) as Promise<{
              teams?: { slug?: string }[];
              users?: { login?: string }[];
            }>,
        ),
      ]);
      return {
        requested: [
          ...(requested?.users ?? []).map((user) => user.login ?? ""),
          ...(requested?.teams ?? []).map((team) => team.slug ?? ""),
        ].filter((login) => login !== ""),
        reviews: (reviews ?? []).flatMap((review) =>
          review.user?.login && review.state
            ? [
                {
                  login: review.user.login,
                  state: review.state,
                  submittedAt: review.submitted_at ?? null,
                  url: review.html_url ?? null,
                },
              ]
            : [],
        ),
      };
    },

    async probeRepository(token, repositoryId) {
      try {
        const raw = (await transport.request({
          auth: asInstallation(token),
          params: { repository_id: repositoryId },
          route: "GET /repositories/{repository_id}",
        })) as RawRepository;
        return { repository: toRepository(raw), status: "ok" as const };
      } catch (error) {
        if (error instanceof GitHubRequestError) {
          if (error.status === 404) {
            return { status: "not-found" as const };
          }
          if (error.status === 401 || error.status === 403) {
            return { status: "forbidden" as const };
          }
        }
        throw error;
      }
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
