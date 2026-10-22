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

interface DoubleRepository {
  id: number;
  issues: DoubleIssue[];
  name: string;
  owner: string;
  private: boolean;
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

  const installationOfToken = (call: GitHubCall) => {
    if (call.auth.kind !== "installation") {
      throw new GitHubRequestError(401);
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
            repositories: [...installation.repositories.values()].map(
              rawRepository,
            ),
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
          return Promise.resolve(repository.issues);
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
        closed?: boolean;
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
        html_url: `https://github.com/${repository.owner}/${repository.name}/issues/${issue.number}`,
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
            { ...repository, issues: [], private: repository.private ?? false },
          ]),
        ),
        uninstalled: false,
      });
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
