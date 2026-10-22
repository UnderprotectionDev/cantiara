// biome-ignore-all lint/performance/noAwaitInLoops: Overview presents each link in order, one read per link.
import {
  GITHUB_APP_PERMISSIONS,
  GITHUB_CONTENTS_REASON,
  type GitHubAppGateway,
  type GitHubExternalRecord,
  type GitHubIntegrationAccess,
  type GitHubIntegrationStore,
  type GitHubIntegrationTransaction,
  type GitHubOverview,
  type GitHubRepository,
  type GitHubRepositoryLink,
  type GitHubStoredInstallation,
  type GitHubStoredLink,
  gitHubAvailableRepositoriesInputSchema,
  gitHubInstallCompleteInputSchema,
  gitHubInstallStartInputSchema,
  gitHubLinkInputSchema,
  gitHubLinkRepositoryInputSchema,
  gitHubProjectInputSchema,
  gitHubSearchRecordsInputSchema,
  groupTriageCandidates,
} from "@cantiara/api/github-integration";

import type { GitHubSecrets } from "./github-credential-envelope";

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
        await transaction.updateLink(link.id, {
          stopReason: "App uninstalled",
        });
      }
    }
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

  async function capture(
    transaction: GitHubIntegrationTransaction,
    token: string,
    link: GitHubStoredLink,
    repository: GitHubRepository,
  ) {
    const snapshots = await requireGateway().listIssues(token, repository);
    await transaction.upsertExternalRecords(
      snapshots.map((snapshot) => ({
        id: newId(),
        linkId: link.id,
        projectId: link.projectId,
        snapshot,
      })),
    );
  }

  async function present(
    transaction: GitHubIntegrationTransaction,
    link: GitHubStoredLink,
    installation: GitHubStoredInstallation | undefined,
  ): Promise<GitHubRepositoryLink> {
    const [history, records] = await Promise.all([
      transaction.nameHistory(link.id),
      transaction.records(link.id),
    ]);
    return {
      accountLogin: installation?.accountLogin ?? "",
      connection:
        link.disconnectedAt || link.stopReason ? "Disconnected" : "Connected",
      disconnectedAt: link.disconnectedAt,
      externalRecordCount: records.length,
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

  return {
    async availableRepositories(accountId, rawInput) {
      const input = gitHubAvailableRepositoriesInputSchema.parse(rawInput);
      return await inScope(accountId, input.projectId, "write", async (tx) => {
        const installation = await activeInstallation(tx, input.installationId);
        const token = await tokenOrRemoved(tx, installation);
        if (token instanceof Refusal) {
          return token;
        }
        const [repositories, links] = await Promise.all([
          requireGateway().listInstallationRepositories(token),
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
        const claims = await tx.claimsOfInstallation(input.installationId);
        if (claims.some((claim) => claim.connectedByAccountId !== accountId)) {
          throw new GitHubInstallationClaimedError();
        }
        const description = await requireGateway().describeInstallation(
          input.installationId,
        );
        if (!description) {
          throw new GitHubInstallationNotFoundError();
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
        const token = await rotateToken(tx, installation);
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
          repositories:
            await requireGateway().listInstallationRepositories(token),
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
        const token = await tokenOrRemoved(tx, installation);
        if (token instanceof Refusal) {
          return token;
        }
        const repositories =
          await requireGateway().listInstallationRepositories(token);
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
            stopReason: null,
          });
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
        };
        await tx.insertLink(link);
        await capture(tx, token, link, repository);
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
        const token = await rotateToken(tx, installation);
        if (!token) {
          await markRemoved(tx, installation.installationId);
          return new Refusal(new GitHubInstallationRemovedError());
        }
        const repository = await requireGateway().getRepository(
          token,
          link.repositoryId,
        );
        if (!repository) {
          await tx.updateLink(link.id, { stopReason: "Repository not found" });
          return new Refusal(new GitHubRepositoryUnavailableError());
        }
        await observeIdentity(tx, link, repository);
        await tx.updateLink(link.id, {
          disconnectedAt: null,
          stopReason: null,
        });
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
        const needle = input.query.toLowerCase().replace(LEADING_HASH, "");
        const matches = (record: GitHubExternalRecord) =>
          needle === "" ||
          [
            record.title,
            record.milestone ?? "",
            String(record.number),
            ...record.labels,
          ].some((value) => value.toLowerCase().includes(needle));
        return {
          records: (await tx.records())
            .filter(matches)
            .sort((a, b) => b.sourceUpdatedAt.localeCompare(a.sourceUpdatedAt))
            .slice(0, SEARCH_LIMIT),
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
          groups: groupTriageCandidates(await tx.records(input.linkId)),
          linkId: input.linkId,
          writesWork: false as const,
        };
      });
    },
  };
}
