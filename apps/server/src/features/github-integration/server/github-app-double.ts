import {
  type GitHubCall,
  GitHubRequestError,
  type GitHubTransport,
} from "./github-app-gateway";

/**
 * GitHub App test double behind the transport port. It answers only the routes
 * on the allow-list and records every request, so a test can prove which calls
 * were made. It is not a mock of the integration: the real gateway, allow-list
 * guard and envelope encryption run on top of it.
 */

interface DoubleIssue {
  body?: string | null;
  head?: { ref: string } | null;
  html_url: string;
  id: number;
  labels: { name: string }[];
  milestone: { title: string } | null;
  number: number;
  pull_request?: { merged_at: string | null };
  state: "open" | "closed";
  title: string;
  updated_at: string;
}

interface DoubleCheckRun {
  app?: { slug: string };
  conclusion: string | null;
  html_url: string;
  id: number;
  is_required?: boolean;
  name: string;
  status: string;
}

interface DoublePullRequest {
  checkRuns: DoubleCheckRun[];
  headSha: string;
  number: number;
  statuses: { context: string; state: string; target_url?: string }[];
}

interface DoubleRepository {
  forbidden?: boolean;
  id: number;
  issues: DoubleIssue[];
  name: string;
  owner: string;
  private: boolean;
  pulls: DoublePullRequest[];
}

interface DoubleInstallation {
  accountLogin: string;
  repositories: Map<number, DoubleRepository>;
  uninstalled: boolean;
}

export interface DoubleClock {
  current: Date;
}

const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export function createGitHubAppDouble(
  clock: DoubleClock = { current: new Date() },
) {
  const installations = new Map<number, DoubleInstallation>();
  const tokens = new Map<string, { expiresAt: Date; installationId: number }>();
  const requests: { auth: GitHubCall["auth"]["kind"]; route: string }[] = [];
  let tokenCounter = 0;
  let rateLimitedUntil: Date | null = null;
  let issueReadsFailing = false;
  const sinceFilters: (string | undefined)[] = [];

  const installationOfToken = (call: GitHubCall) => {
    if (call.auth.kind !== "installation") {
      throw new GitHubRequestError(401);
    }
    if (rateLimitedUntil && rateLimitedUntil > clock.current) {
      throw new GitHubRequestError(
        429,
        Math.ceil(
          (rateLimitedUntil.getTime() - clock.current.getTime()) / 1000,
        ),
      );
    }
    const issued = tokens.get(call.auth.token);
    if (!issued || issued.expiresAt <= clock.current) {
      throw new GitHubRequestError(401);
    }
    const installation = installations.get(issued.installationId);
    if (!installation || installation.uninstalled) {
      throw new GitHubRequestError(401);
    }
    return installation;
  };

  const findRepository = (installation: DoubleInstallation, id: number) => {
    const repository = installation.repositories.get(id);
    if (!repository) {
      throw new GitHubRequestError(404);
    }
    if (repository.forbidden) {
      throw new GitHubRequestError(403);
    }
    return repository;
  };

  const repositoryOf = (call: GitHubCall) => {
    const installation = installationOfToken(call);
    const repository = [...installation.repositories.values()].find(
      (candidate) =>
        candidate.owner === call.params.owner &&
        candidate.name === call.params.repo,
    );
    if (!repository) {
      throw new GitHubRequestError(404);
    }
    return repository;
  };

  const rawRepository = (repository: DoubleRepository) => ({
    full_name: `${repository.owner}/${repository.name}`,
    html_url: `https://github.com/${repository.owner}/${repository.name}`,
    id: repository.id,
    name: repository.name,
    owner: { login: repository.owner },
    private: repository.private,
  });

  const transport: GitHubTransport = {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The double answers each allow-listed route in one switch.
    request(call) {
      requests.push({ auth: call.auth.kind, route: call.route });
      const { params } = call;
      switch (call.route) {
        case "GET /app/installations/{installation_id}": {
          const installation = installations.get(
            Number(params.installation_id),
          );
          if (!installation || installation.uninstalled) {
            throw new GitHubRequestError(404);
          }
          return Promise.resolve({
            account: { login: installation.accountLogin },
            id: Number(params.installation_id),
          });
        }
        case "POST /app/installations/{installation_id}/access_tokens": {
          const id = Number(params.installation_id);
          const installation = installations.get(id);
          if (!installation || installation.uninstalled) {
            throw new GitHubRequestError(404);
          }
          tokenCounter += 1;
          const token = `ghs_double_${id}_${tokenCounter}`;
          const expiresAt = new Date(
            clock.current.getTime() + TOKEN_LIFETIME_MS,
          );
          tokens.set(token, { expiresAt, installationId: id });
          return Promise.resolve({
            expires_at: expiresAt.toISOString(),
            token,
          });
        }
        case "GET /installation/repositories": {
          const installation = installationOfToken(call);
          return Promise.resolve({
            repositories: [...installation.repositories.values()]
              .filter((repository) => !repository.forbidden)
              .map(rawRepository),
          });
        }
        case "GET /repositories/{repository_id}": {
          const installation = installationOfToken(call);
          return Promise.resolve(
            rawRepository(
              findRepository(installation, Number(params.repository_id)),
            ),
          );
        }
        case "GET /repos/{owner}/{repo}/issues": {
          const installation = installationOfToken(call);
          const repository = [...installation.repositories.values()].find(
            (candidate) =>
              candidate.owner === params.owner &&
              candidate.name === params.repo,
          );
          if (!repository) {
            throw new GitHubRequestError(404);
          }
          if (issueReadsFailing) {
            throw new GitHubRequestError(500);
          }
          const since = params.since ? String(params.since) : undefined;
          sinceFilters.push(since);
          const perPage = Number(params.per_page ?? 30);
          const page = Number(params.page ?? 1);
          const matching = repository.issues
            .filter((issue) => !since || issue.updated_at >= since)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
          return Promise.resolve(
            matching.slice((page - 1) * perPage, page * perPage),
          );
        }
        case "GET /repos/{owner}/{repo}/issues/{issue_number}": {
          const installation = installationOfToken(call);
          const repository = [...installation.repositories.values()].find(
            (candidate) =>
              candidate.owner === params.owner &&
              candidate.name === params.repo,
          );
          const issue = repository?.issues.find(
            (candidate) => candidate.number === Number(params.issue_number),
          );
          if (!issue) {
            throw new GitHubRequestError(404);
          }
          return Promise.resolve(issue);
        }
        case "GET /repos/{owner}/{repo}/pulls": {
          const repository = repositoryOf(call);
          return Promise.resolve(
            repository.pulls.map((pull) => ({
              head: { sha: pull.headSha },
              number: pull.number,
            })),
          );
        }
        case "GET /repos/{owner}/{repo}/commits/{ref}/check-runs": {
          const repository = repositoryOf(call);
          return Promise.resolve({
            check_runs: repository.pulls
              .filter((pull) => pull.headSha === params.ref)
              .flatMap((pull) => pull.checkRuns),
          });
        }
        case "GET /repos/{owner}/{repo}/commits/{ref}/status": {
          const repository = repositoryOf(call);
          return Promise.resolve({
            statuses: repository.pulls
              .filter((pull) => pull.headSha === params.ref)
              .flatMap((pull) => pull.statuses),
          });
        }
        case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}": {
          installationOfToken(call);
          return Promise.resolve({
            html_url: `https://github.com/${String(params.owner)}/${String(params.repo)}/commit/${String(params.commit_sha)}`,
            sha: params.commit_sha,
          });
        }
        default:
          throw new GitHubRequestError(404);
      }
    },
  };

  return {
    addIssue(
      installationId: number,
      repositoryId: number,
      issue: {
        body?: string;
        closed?: boolean;
        headBranch?: string;
        id: number;
        labels?: string[];
        milestone?: string;
        number: number;
        pullRequest?: boolean;
        title: string;
        updatedAt?: string;
      },
    ) {
      const repository = installations
        .get(installationId)
        ?.repositories.get(repositoryId);
      if (!repository) {
        throw new Error("Unknown double repository");
      }
      repository.issues.push({
        ...(issue.body === undefined ? {} : { body: issue.body }),
        ...(issue.headBranch === undefined
          ? {}
          : { head: { ref: issue.headBranch } }),
        html_url: `https://github.com/${repository.owner}/${repository.name}/${issue.pullRequest ? "pull" : "issues"}/${issue.number}`,
        id: issue.id,
        labels: (issue.labels ?? []).map((name) => ({ name })),
        milestone: issue.milestone ? { title: issue.milestone } : null,
        number: issue.number,
        ...(issue.pullRequest ? { pull_request: { merged_at: null } } : {}),
        state: issue.closed ? "closed" : "open",
        title: issue.title,
        updated_at: issue.updatedAt ?? clock.current.toISOString(),
      });
    },
    install(
      installationId: number,
      accountLogin: string,
      repositories: {
        id: number;
        name: string;
        owner: string;
        private?: boolean;
      }[],
    ) {
      installations.set(installationId, {
        accountLogin,
        repositories: new Map(
          repositories.map((repository) => [
            repository.id,
            {
              ...repository,
              issues: [],
              private: repository.private ?? false,
              pulls: [],
            },
          ]),
        ),
        uninstalled: false,
      });
    },
    /** An open Pull request at a head SHA with the checks GitHub shows on it. */
    setPullRequestChecks(
      installationId: number,
      repositoryId: number,
      pull: {
        checkRuns?: {
          appSlug?: string;
          conclusion?: string | null;
          id: number;
          name: string;
          required?: boolean;
          status?: string;
        }[];
        headSha: string;
        number: number;
        statuses?: { context: string; state: string }[];
      },
    ) {
      const repository = installations
        .get(installationId)
        ?.repositories.get(repositoryId);
      if (!repository) {
        throw new Error("Unknown double repository");
      }
      repository.pulls = [
        ...repository.pulls.filter((item) => item.number !== pull.number),
        {
          checkRuns: (pull.checkRuns ?? []).map((run) => ({
            app: { slug: run.appSlug ?? "github-actions" },
            conclusion: run.conclusion ?? null,
            html_url: `https://github.com/${repository.owner}/${repository.name}/runs/${run.id}`,
            id: run.id,
            ...(run.required === undefined
              ? {}
              : { is_required: run.required }),
            name: run.name,
            status: run.status ?? "completed",
          })),
          headSha: pull.headSha,
          number: pull.number,
          statuses: pull.statuses ?? [],
        },
      ];
    },
    /** The Repository is still there but the App may no longer read it (403). */
    forbidRepository(installationId: number, repositoryId: number) {
      const repository = installations
        .get(installationId)
        ?.repositories.get(repositoryId);
      if (repository) {
        repository.forbidden = true;
      }
    },
    /** GitHub answers every installation read with 429 and `Retry-After` until `until`. */
    rateLimitUntil(until: Date | null) {
      rateLimitedUntil = until;
    },
    /** GitHub answers every issue-list read with a server error. */
    failIssueReads(failing: boolean) {
      issueReadsFailing = failing;
    },
    /** The `since` filter of each issue-list request, in order. */
    sinceFilters,
    updateIssue(
      installationId: number,
      repositoryId: number,
      number: number,
      change: { closed?: boolean; title?: string; updatedAt: string },
    ) {
      const issue = installations
        .get(installationId)
        ?.repositories.get(repositoryId)
        ?.issues.find((candidate) => candidate.number === number);
      if (!issue) {
        throw new Error("Unknown double issue");
      }
      issue.updated_at = change.updatedAt;
      if (change.title !== undefined) {
        issue.title = change.title;
      }
      if (change.closed !== undefined) {
        issue.state = change.closed ? "closed" : "open";
      }
    },
    removeRepositoryAccess(installationId: number, repositoryId: number) {
      installations.get(installationId)?.repositories.delete(repositoryId);
    },
    renameRepository(
      installationId: number,
      repositoryId: number,
      change: { name?: string; owner?: string },
    ) {
      const repository = installations
        .get(installationId)
        ?.repositories.get(repositoryId);
      if (!repository) {
        throw new Error("Unknown double repository");
      }
      Object.assign(repository, change);
    },
    requests,
    transport,
    uninstall(installationId: number) {
      const installation = installations.get(installationId);
      if (installation) {
        installation.uninstalled = true;
      }
    },
  };
}

export type GitHubAppDouble = ReturnType<typeof createGitHubAppDouble>;
